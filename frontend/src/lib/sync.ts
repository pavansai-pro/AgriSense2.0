import { api, tokens } from "@/lib/api";
import { db, type LocalRecord } from "@/lib/offline-db";

const LAST_PULL = "agrisense.lastPull";

type PushResult = { client_id: string; status: string; error?: unknown };
type PullRecord = Omit<LocalRecord, "synced">;

export type SyncSummary = { pushed: number; pulled: number; failed: number };

export async function pendingCount() {
  return db.records.where("synced").equals(0).count();
}

export async function syncNow(onProgress?: (done: number, total: number) => void): Promise<SyncSummary> {
  if (!tokens.access || !navigator.onLine) return { pushed: 0, pulled: 0, failed: 0 };
  const pending = await db.records.where("synced").equals(0).toArray();
  let pushed = 0;
  let failed = 0;
  const batchSize = 50;
  for (let i = 0; i < pending.length; i += batchSize) {
    const batch = pending.slice(i, i + batchSize);
    const res = await api<{ results: PushResult[] }>("/api/sync/push", {
      method: "POST",
      json: {
        records: batch.map(({ client_id, kind, payload, updated_at, deleted }) => ({
          client_id,
          kind,
          payload,
          updated_at,
          deleted,
        })),
      },
    });
    for (const r of res.results) {
      if (r.status === "error") {
        failed++;
        await db.records.update(r.client_id, { sync_error: JSON.stringify(r.error) });
      } else {
        pushed++;
        await db.records.update(r.client_id, { synced: 1, sync_error: undefined });
      }
    }
    onProgress?.(Math.min(i + batchSize, pending.length), pending.length);
  }

  const since = localStorage.getItem(LAST_PULL);
  const pull = await api<{ records: PullRecord[]; server_time: string }>(
    `/api/sync/pull${since ? `?since=${encodeURIComponent(since)}` : ""}`,
  );
  let pulled = 0;
  for (const rec of pull.records) {
    const local = await db.records.get(rec.client_id);
    if (local && local.synced === 0 && local.updated_at > rec.updated_at) continue;
    await db.records.put({ ...rec, synced: 1 });
    pulled++;
  }
  localStorage.setItem(LAST_PULL, pull.server_time);
  return { pushed, pulled, failed };
}
