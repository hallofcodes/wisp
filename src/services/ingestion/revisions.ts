import type { NormalizedRecord, SyncWarning } from "@/providers/base/types";
import { contentHash } from "@/services/normalization/values";

/** The latest stored revision of a source record. */
export interface StoredRevision {
  id: string;
  revision: number;
  contentHash: string;
}

export interface PlannedRecord {
  record: NormalizedRecord;
  hash: string;
  revision: number;
  /** Id of the stored row this revision supersedes, if any. */
  supersedesId: string | null;
}

export interface RevisionPlan {
  inserts: PlannedRecord[];
  revisions: PlannedRecord[];
  unchanged: number;
  /** Records dropped because the same key arrived with different content. */
  conflicts: number;
  warnings: SyncWarning[];
}

export function planRevisions(
  incoming: NormalizedRecord[],
  latestByKey: ReadonlyMap<string, StoredRevision>,
): RevisionPlan {
  const byKey = new Map<
    string,
    { record: NormalizedRecord; hash: string } | "conflict"
  >();
  const conflictKeys: string[] = [];

  for (const record of incoming) {
    const hash = contentHash(record);
    const seen = byKey.get(record.sourceRecordId);
    if (seen === undefined) {
      byKey.set(record.sourceRecordId, { record, hash });
    } else if (seen !== "conflict" && seen.hash !== hash) {
      byKey.set(record.sourceRecordId, "conflict");
      conflictKeys.push(record.sourceRecordId);
    }
  }

  const plan: RevisionPlan = {
    inserts: [],
    revisions: [],
    unchanged: 0,
    conflicts: 0,
    warnings: [],
  };

  for (const [key, entry] of byKey) {
    if (entry === "conflict") continue;
    const stored = latestByKey.get(key);
    if (!stored) {
      plan.inserts.push({ ...entry, revision: 1, supersedesId: null });
    } else if (stored.contentHash === entry.hash) {
      plan.unchanged++;
    } else {
      plan.revisions.push({
        ...entry,
        revision: stored.revision + 1,
        supersedesId: stored.id,
      });
    }
  }

  if (conflictKeys.length > 0) {
    const conflictSet = new Set(conflictKeys);
    plan.conflicts = incoming.filter((r) =>
      conflictSet.has(r.sourceRecordId),
    ).length;
    plan.warnings.push({
      code: "CONFLICTING_DUPLICATES",
      message: `${conflictKeys.length} source record key(s) appeared more than once with different values and were skipped.`,
      context: { keys: conflictKeys.slice(0, 20) },
    });
  }

  return plan;
}
