"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/offline-db";

type State<T> = { path: string | null; data: T | null; savedAt: string | null; error: string | null; loading: boolean };

/** Fetch JSON with an IndexedDB fallback so pages keep working offline. */
export function useCachedQuery<T>(path: string | null) {
  const [state, setState] = useState<State<T>>({ path, data: null, savedAt: null, error: null, loading: Boolean(path) });
  const latest = useRef(path);
  latest.current = path;

  const load = useCallback(async () => {
    if (!path) return;
    const current = () => latest.current === path;
    setState((s) => (s.path === path ? { ...s, loading: true, error: null } : { path, data: null, savedAt: null, error: null, loading: true }));
    const cached = await cacheGet<T>(path);
    if (!current()) return;
    if (cached) setState((s) => ({ ...s, data: cached.value, savedAt: cached.saved_at }));
    if (navigator.onLine) {
      try {
        const fresh = await api<T>(path);
        if (!current()) return;
        setState((s) => ({ ...s, data: fresh, savedAt: null }));
        await cacheSet(path, fresh);
      } catch (e) {
        if (!current()) return;
        setState((s) => ({ ...s, error: e instanceof Error ? e.message : String(e) }));
      }
    }
    if (current()) setState((s) => ({ ...s, loading: false }));
  }, [path]);

  useEffect(() => {
    void load();
  }, [load]);

  // Never show data that belongs to a previous path.
  const own = state.path === path;
  return {
    data: own ? state.data : null,
    loading: own ? state.loading : Boolean(path),
    error: own ? state.error : null,
    savedAt: own ? state.savedAt : null,
    reload: load,
  };
}
