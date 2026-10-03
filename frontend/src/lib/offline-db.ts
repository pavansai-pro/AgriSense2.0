import Dexie, { type EntityTable } from "dexie";

export type RecordKind = "soil_reading" | "harvest_record";

export type LocalRecord = {
  client_id: string;
  kind: RecordKind;
  payload: Record<string, unknown>;
  updated_at: string;
  deleted: boolean;
  synced: 0 | 1;
  sync_error?: string;
};

export type CacheEntry = { key: string; value: unknown; saved_at: string };

class AgriSenseDB extends Dexie {
  records!: EntityTable<LocalRecord, "client_id">;
  cache!: EntityTable<CacheEntry, "key">;

  constructor() {
    super("agrisense");
    this.version(1).stores({
      records: "client_id, kind, synced, updated_at",
      cache: "key",
    });
  }
}

export const db = new AgriSenseDB();

export function newClientId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function saveRecord(kind: RecordKind, payload: Record<string, unknown>, clientId?: string) {
  const rec: LocalRecord = {
    client_id: clientId ?? newClientId(),
    kind,
    payload,
    updated_at: new Date().toISOString(),
    deleted: false,
    synced: 0,
  };
  await db.records.put(rec);
  return rec;
}

export async function deleteRecord(clientId: string) {
  await db.records.update(clientId, { deleted: true, synced: 0, updated_at: new Date().toISOString() });
}

export async function cacheSet(key: string, value: unknown) {
  await db.cache.put({ key, value, saved_at: new Date().toISOString() });
}

export async function cacheGet<T>(key: string): Promise<{ value: T; saved_at: string } | null> {
  const hit = await db.cache.get(key);
  return hit ? { value: hit.value as T, saved_at: hit.saved_at } : null;
}
