import { api, tokens } from "@/lib/api";
import { db, getRecordOwner, type LocalRecord } from "@/lib/offline-db";

const LAST_PULL = "agrisense.lastPull";

type PushResult = { client_id: string; status: string; error?: unknown };
type PullRecord = Omit<LocalRecord, "synced" | "owner">;

export type SyncSummary = { pushed: number; pulled: number; failed: number };

function cursorKey(owner: number) {
  return `${LAST_PULL}.${owner}`;
}

function pendingQuery(owner: number) {
  return db.records.where("[owner+synced]").equals([owner, 0]);
}

export async function pendingCount() {
  const owner = getRecordOwner();
  return owner === null ? 0 : pendingQuery(owner).count();
}

function unchanged(current: LocalRecord | undefined, sent: LocalRecord) {
  return !!current && current.updated_at === sent.updated_at && current.deleted === sent.deleted;
}

export async function syncNow(onProgress?: (done: number, total: number) => void): Promise<SyncSummary> {
  const owner = getRecordOwner();
  if (owner === null || !tokens.access || !navigator.onLine) return { pushed: 0, pulled: 0, failed: 0 };
  const pending = await pendingQuery(owner).toArray();
  let pushed = 0;
  let failed = 0;
  const batchSize = 50;
  for (let i = 0; i < pending.length; i += batchSize) {
    const batch = pending.slice(i, i + batchSize);
    const sent = new Map(batch.map((r) => [r.client_id, r]));
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
    await db.transaction("rw", db.records, async () => {
      for (const r of res.results) {
        const snapshot = sent.get(r.client_id);
        const current = await db.records.get(r.client_id);
        // Edited or deleted while the request was in flight: keep it pending for the next push.
        if (!snapshot || !unchanged(current, snapshot)) continue;
        if (r.status === "error") {
          failed++;
          await db.records.update(r.client_id, { sync_error: JSON.stringify(r.error) });
        } else {
          pushed++;
          await db.records.update(r.client_id, { synced: 1, sync_error: undefined });
        }
      }
    });
    onProgress?.(Math.min(i + batchSize, pending.length), pending.length);
  }

  const since = localStorage.getItem(cursorKey(owner));
  const pull = await api<{ records: PullRecord[]; server_time: string }>(
    `/api/sync/pull${since ? `?since=${encodeURIComponent(since)}` : ""}`,
  );
  let pulled = 0;
  await db.transaction("rw", db.records, async () => {
    for (const rec of pull.records) {
      const local = await db.records.get(rec.client_id);
      if (local && local.synced === 0 && local.updated_at >= rec.updated_at) continue;
      await db.records.put({ ...rec, owner, synced: 1 });
      pulled++;
    }
  });
  localStorage.setItem(cursorKey(owner), pull.server_time);
  return { pushed, pulled, failed };
}
