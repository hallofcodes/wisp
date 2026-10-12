import type {
  ProviderSyncStatus,
  SyncResult,
  SyncWarning,
  WriteStats,
} from "./types";

export function buildSyncResult(
  providerId: string,
  input: {
    status: ProviderSyncStatus;
    recordsProcessed?: number;
    stats?: WriteStats;
    skipped?: number;
    warnings?: SyncWarning[];
    errorMessage?: string | null;
  },
): SyncResult {
  const stats = input.stats;
  return {
    providerId,
    status: input.status,
    recordsProcessed: input.recordsProcessed ?? 0,
    recordsInserted: stats?.inserted ?? 0,
    recordsUpdated: stats?.revised ?? 0,
    recordsUnchanged: stats?.unchanged ?? 0,
    recordsSkipped: (input.skipped ?? 0) + (stats?.skipped ?? 0),
    warnings: [...(input.warnings ?? []), ...(stats?.warnings ?? [])],
    errorMessage: input.errorMessage ?? null,
  };
}
