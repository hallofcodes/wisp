import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";

export interface LockHandle {
  key: string;
  holder: string;
  /** Extends the lease; returns false if the lock was lost. */
  renew(): Promise<boolean>;
  release(): Promise<void>;
}

export async function acquireLock(
  db: PrismaClient,
  key: string,
  leaseMs: number,
): Promise<LockHandle | null> {
  const holder = `${process.pid}:${randomUUID()}`;
  const acquired = await db.$queryRaw<{ holder: string }[]>`
    INSERT INTO "SyncLock" ("key", "holder", "acquiredAt", "expiresAt")
    VALUES (${key}, ${holder}, now(), now() + make_interval(secs => ${leaseMs / 1000}))
    ON CONFLICT ("key") DO UPDATE
      SET "holder" = EXCLUDED."holder", "acquiredAt" = EXCLUDED."acquiredAt", "expiresAt" = EXCLUDED."expiresAt"
      WHERE "SyncLock"."expiresAt" < now()
    RETURNING "holder"`;
  if (acquired[0]?.holder !== holder) return null;

  return {
    key,
    holder,
    async renew() {
      const updated = await db.$executeRaw`
        UPDATE "SyncLock" SET "expiresAt" = now() + make_interval(secs => ${leaseMs / 1000})
        WHERE "key" = ${key} AND "holder" = ${holder}`;
      return updated === 1;
    },
    async release() {
      await db.$executeRaw`DELETE FROM "SyncLock" WHERE "key" = ${key} AND "holder" = ${holder}`;
    },
  };
}
