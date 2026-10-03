"use client";

import { useTheme } from "next-themes";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { api, tokens } from "@/lib/api";
import { type MessageKey, translate } from "@/lib/i18n";
import { LANGUAGES, type Lang } from "@/lib/languages";
import { cacheGet, cacheSet, setRecordOwner } from "@/lib/offline-db";
import { pendingCount, syncNow } from "@/lib/sync";
import type { TokenResponse, User } from "@/lib/types";

const LANG_KEY = "agrisense.lang";

type SyncState = { running: boolean; done: number; total: number; pending: number; lastSyncedAt: string | null };

type AppContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  user: User | null;
  setUser: (user: User) => void;
  authReady: boolean;
  signIn: (res: TokenResponse) => void;
  signOut: () => void;
  online: boolean;
  sync: SyncState;
  runSync: () => Promise<void>;
  refreshPending: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = use(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}

const isLang = (v: string | null | undefined): v is Lang => LANGUAGES.some((l) => l.code === v);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { setTheme } = useTheme();
  const [lang, setLangState] = useState<Lang>("en");
  const [user, setUserState] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [online, setOnline] = useState(true);
  const [sync, setSync] = useState<SyncState>({ running: false, done: 0, total: 0, pending: 0, lastSyncedAt: null });
  const syncing = useRef(false);

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang],
  );

  const setUser = useCallback((u: User) => {
    setRecordOwner(u.id);
    setUserState(u);
    void cacheSet("user", u);
  }, []);

  const setLang = useCallback(
    (next: Lang) => {
      setLangState(next);
      localStorage.setItem(LANG_KEY, next);
      if (tokens.access && navigator.onLine) {
        api<User>("/api/auth/me", { method: "PATCH", json: { language: next } }).then(setUser).catch(() => {});
      }
    },
    [setUser],
  );

  const refreshPending = useCallback(async () => {
    const pending = await pendingCount();
    setSync((s) => ({ ...s, pending }));
  }, []);

  const runSync = useCallback(async () => {
    if (syncing.current || !tokens.access || !navigator.onLine) return;
    syncing.current = true;
    setSync((s) => ({ ...s, running: true, done: 0, total: s.pending }));
    try {
      const summary = await syncNow((done, total) => setSync((s) => ({ ...s, done, total })));
      if (summary.pushed > 0) toast.success(translate(lang, "allSynced"));
      setSync((s) => ({ ...s, lastSyncedAt: new Date().toISOString() }));
    } catch {
      // Network dropped mid-sync; records stay queued and retry on the next trigger.
    } finally {
      syncing.current = false;
      const pending = await pendingCount();
      setSync((s) => ({ ...s, running: false, pending }));
    }
  }, [lang]);

  const signIn = useCallback(
    (res: TokenResponse) => {
      tokens.set(res.access_token, res.refresh_token);
      setUser(res.user);
      if (isLang(res.user.language)) {
        setLangState(res.user.language);
        localStorage.setItem(LANG_KEY, res.user.language);
      }
      if (res.user.theme === "dark" || res.user.theme === "light") setTheme(res.user.theme);
    },
    [setTheme, setUser],
  );

  const signOut = useCallback(() => {
    tokens.clear();
    setRecordOwner(null);
    setUserState(null);
    setSync((s) => ({ ...s, pending: 0, done: 0, total: 0 }));
    void cacheSet("user", null);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(LANG_KEY);
    if (isLang(stored)) setLangState(stored);
    setOnline(navigator.onLine);

    (async () => {
      if (tokens.access) {
        const cached = await cacheGet<User | null>("user");
        if (cached?.value) {
          setRecordOwner(cached.value.id);
          setUserState(cached.value);
        }
        if (navigator.onLine) {
          try {
            setUser(await api<User>("/api/auth/me"));
          } catch {
            if (!tokens.access) {
              setRecordOwner(null);
              setUserState(null);
            }
          }
        }
      }
      setAuthReady(true);
      await refreshPending();
    })();

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, [refreshPending, setUser]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      void runSync();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const interval = window.setInterval(() => void runSync(), 60_000);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.clearInterval(interval);
    };
  }, [runSync]);

  useEffect(() => {
    if (user && online) void runSync();
  }, [user, online, runSync]);

  const value = useMemo(
    () => ({
      lang, setLang, t, user, setUser, authReady, signIn, signOut, online, sync, runSync, refreshPending,
    }),
    [lang, setLang, t, user, setUser, authReady, signIn, signOut, online, sync, runSync, refreshPending],
  );

  return <AppContext value={value}>{children}</AppContext>;
}
