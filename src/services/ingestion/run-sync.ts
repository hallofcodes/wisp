import type { PrismaClient } from "@/generated/prisma/client";
import type { SyncStatus, SyncTrigger } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import type { HttpClientOptions } from "@/providers/base/http";
import type { SourceDescriptor, SyncResult } from "@/providers/base/types";
import { getProviderRegistration } from "@/providers/registry";
import { acquireLock } from "./lock";
import { PrismaReportSink } from "./prisma-report-sink";
import { PrismaObservationSink } from "./prisma-sink";

const LEASE_MS = 15 * 60_000;
const RENEW_EVERY_MS = 60_000;

export interface RunSyncOptions {
  trigger: SyncTrigger;
  /** HTTP overrides for tests. */
  http?: Partial<HttpClientOptions>;
}

export interface RunSyncOutcome {
  jobId: string;
  status: SyncStatus;
  result: SyncResult | null;
}

/** Creates or refreshes the DataSource row from the provider's descriptor. */
export async function upsertDataSource(
  db: PrismaClient,
  descriptor: SourceDescriptor,
) {
  const fields = {
    name: descriptor.name,
    organization: descriptor.organization,
    homepageUrl: descriptor.homepageUrl,
    documentationUrl: descriptor.documentationUrl,
    license: descriptor.license,
    licenseUrl: descriptor.licenseUrl,
    attributionRequirements: descriptor.attributionRequirements,
  };
  return db.dataSource.upsert({
    where: { slug: descriptor.id },
    create: { slug: descriptor.id, ...fields },
    update: fields,
  });
}

/**
 * Runs one provider sync with locking and job logging. Intended for workers
 * and CLI scripts only; never call this from a page or API request.
 */
export async function runSync(
  db: PrismaClient,
  providerId: string,
  options: RunSyncOptions,
): Promise<RunSyncOutcome> {
  const registration = getProviderRegistration(providerId);
  const source = await upsertDataSource(db, registration.descriptor);

  if (!source.enabled) {
    const job = await db.syncJob.create({
      data: {
        sourceId: source.id,
        trigger: options.trigger,
        status: "SKIPPED",
        completedAt: new Date(),
        errorMessage: "Source is disabled.",
      },
    });
    return { jobId: job.id, status: "SKIPPED", result: null };
  }

  const lock = await acquireLock(db, `sync:${providerId}`, LEASE_MS);
  if (!lock) {
    const job = await db.syncJob.create({
      data: {
        sourceId: source.id,
        trigger: options.trigger,
        status: "SKIPPED",
        completedAt: new Date(),
        errorMessage: "Another sync for this source is already running.",
      },
    });
    return { jobId: job.id, status: "SKIPPED", result: null };
  }

  const heartbeat = setInterval(() => {
    lock.renew().catch(() => undefined);
  }, RENEW_EVERY_MS);
  heartbeat.unref?.();

  try {
    // Holding the lock means any RUNNING job for this source was abandoned.
    await db.syncJob.updateMany({
      where: { sourceId: source.id, status: "RUNNING" },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: "Abandoned: worker stopped before completion.",
      },
    });

    const job = await db.syncJob.create({
      data: {
        sourceId: source.id,
        trigger: options.trigger,
        status: "RUNNING",
      },
    });

    const diseases = await db.disease.findMany({ select: { slug: true } });
    const provider = registration.create({
      observations: new PrismaObservationSink(db, source.id, job.id),
      reports: new PrismaReportSink(db, source.id),
      knownDiseaseSlugs: new Set(diseases.map((d) => d.slug)),
      http: options.http,
    });

    let result: SyncResult;
    try {
      result = await provider.sync();
    } catch (error) {
      result = {
        providerId,
        status: "FAILED",
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsUnchanged: 0,
        recordsSkipped: 0,
        warnings: [],
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }

    const completedAt = new Date();
    await db.syncJob.update({
      where: { id: job.id },
      data: {
        status: result.status,
        completedAt,
        recordsProcessed: result.recordsProcessed,
        recordsInserted: result.recordsInserted,
        recordsUpdated: result.recordsUpdated,
        recordsUnchanged: result.recordsUnchanged,
        recordsSkipped: result.recordsSkipped,
        errorMessage: result.errorMessage,
        warnings: result.warnings as unknown as Prisma.InputJsonValue,
      },
    });

    // Partial syncs are tracked per indicator (SourceIndicator.lastSuccessfulSync);
    // the source-level timestamp only moves when everything succeeded.
    if (result.status === "SUCCEEDED") {
      await db.dataSource.update({
        where: { id: source.id },
        data: { lastSuccessfulSync: completedAt },
      });
    }

    await db.auditLog.create({
      data: {
        action: "sync.completed",
        entityType: "SyncJob",
        entityId: job.id,
        metadata: {
          providerId,
          trigger: options.trigger,
          status: result.status,
          inserted: result.recordsInserted,
          revised: result.recordsUpdated,
          warnings: result.warnings.length,
        },
      },
    });

    return { jobId: job.id, status: result.status, result };
  } finally {
    clearInterval(heartbeat);
    await lock.release();
  }
}
