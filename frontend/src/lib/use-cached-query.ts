"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/offline-db";

/** Fetch JSON with an IndexedDB fallback so pages keep working offline. */
export function useCachedQuery<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError(null);
    const cached = await cacheGet<T>(path);
    if (cached) {
      setData(cached.value);
      setSavedAt(cached.saved_at);
    }
    if (navigator.onLine) {
      try {
        const fresh = await api<T>(path);
        setData(fresh);
        setSavedAt(null);
        await cacheSet(path, fresh);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
    setLoading(false);
  }, [path]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, savedAt, reload: load };
}
