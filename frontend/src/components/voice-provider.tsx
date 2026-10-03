"use client";

import { useTheme } from "next-themes";
import { usePathname, useRouter } from "next/navigation";
import { createContext, use, useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

import { useApp } from "@/components/app-provider";
import { api, tokens } from "@/lib/api";
import { speechLang } from "@/lib/languages";
import { type Intent, matchIntent } from "@/lib/voice/commands";
import { speak as speakRaw, useSpeechRecognition } from "@/lib/voice/speech";

/** Page-level handler: return true when it consumed the transcript. */
export type VoiceHandler = (transcript: string, intent: Intent | null) => boolean | Promise<boolean>;

type VoiceContextValue = {
  supported: boolean;
  listening: boolean;
  interim: string;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  listenOnce: () => Promise<string | null>;
  speak: (text: string) => void;
  register: (handler: VoiceHandler) => () => void;
};

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function useVoice() {
  const ctx = use(VoiceContext);
  if (!ctx) throw new Error("useVoice must be used inside <VoiceProvider>");
  return ctx;
}

/** Register a handler that gets first refusal on every recognised phrase while the component is mounted. */
export function useVoiceHandler(handler: VoiceHandler) {
  const { register } = useVoice();
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => register((text, intent) => ref.current(text, intent)), [register]);
}

const ROUTE_LABEL = {
  "/dashboard": "dashboard",
  "/crop": "crop",
  "/risk": "risk",
  "/weather": "weather",
  "/records": "records",
  "/assistant": "assistant",
  "/settings": "settings",
  "/profile": "profile",
  "/login": "login",
} as const;

type LogEntry = { transcript: string; lang: string; intent: string | null; matched: boolean; confidence?: number; route: string };

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const { lang, setLang, t, signOut, runSync } = useApp();
  const { setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const recognition = useSpeechRecognition(speechLang(lang));
  const handlers = useRef<VoiceHandler[]>([]);
  const logQueue = useRef<LogEntry[]>([]);

  const speak = useCallback((text: string) => speakRaw(text, speechLang(lang)), [lang]);

  const register = useCallback((handler: VoiceHandler) => {
    handlers.current.push(handler);
    return () => {
      handlers.current = handlers.current.filter((h) => h !== handler);
    };
  }, []);

  const flushLogs = useCallback(() => {
    if (!tokens.access || !navigator.onLine || logQueue.current.length === 0) return;
    const batch = logQueue.current.splice(0, logQueue.current.length);
    api("/api/voice/logs", { method: "POST", json: batch }).catch(() => {});
  }, []);

  useEffect(() => {
    const id = window.setInterval(flushLogs, 15_000);
    return () => window.clearInterval(id);
  }, [flushLogs]);

  const runIntent = useCallback(
    (intent: Intent): boolean => {
      switch (intent.type) {
        case "navigate": {
          router.push(intent.route);
          const key = ROUTE_LABEL[intent.route as keyof typeof ROUTE_LABEL];
          if (key) speak(t(key));
          return true;
        }
        case "logout":
          signOut();
          router.push("/login");
          speak(t("logout"));
          return true;
        case "theme":
          setTheme(intent.value);
          if (tokens.access) api("/api/auth/me", { method: "PATCH", json: { theme: intent.value } }).catch(() => {});
          return true;
        case "language":
          setLang(intent.value);
          return true;
        case "help":
          speak(t("help"));
          toast.info(t("help"));
          return true;
        case "sync":
          void runSync();
          speak(t("syncing"));
          return true;
        case "submit": {
          const btn = document.querySelector<HTMLButtonElement>("[data-voice-submit]");
          if (!btn) return false;
          btn.click();
          return true;
        }
        case "read": {
          const text = Array.from(document.querySelectorAll<HTMLElement>("[data-speak]"))
            .map((el) => el.innerText)
            .join(". ");
          if (!text) return false;
          speak(text);
          return true;
        }
      }
    },
    [router, speak, t, signOut, setTheme, setLang, runSync],
  );

  const listenOnce = useCallback(async () => {
    const res = await recognition.listen();
    return res?.transcript ?? null;
  }, [recognition]);

  const start = useCallback(async () => {
    if (!recognition.supported) {
      toast.error(t("voiceUnsupported"));
      return;
    }
    window.speechSynthesis?.cancel();
    const res = await recognition.listen();
    if (!res?.transcript) return;
    const intent = matchIntent(res.transcript, lang);
    let handled = false;
    for (const h of [...handlers.current].reverse()) {
      if (await h(res.transcript, intent)) {
        handled = true;
        break;
      }
    }
    if (!handled && intent) handled = runIntent(intent);
    if (!handled) {
      speak(t("notUnderstood"));
      toast(`“${res.transcript}”`, { description: t("notUnderstood") });
    }
    logQueue.current.push({
      transcript: res.transcript.slice(0, 500),
      lang: speechLang(lang),
      intent: intent ? (intent.type === "navigate" ? intent.route : intent.type) : null,
      matched: handled,
      confidence: res.confidence,
      route: pathname,
    });
  }, [recognition, lang, runIntent, speak, t, pathname]);

  const value = useMemo(
    () => ({
      supported: recognition.supported,
      listening: recognition.listening,
      interim: recognition.interim,
      error: recognition.error,
      start,
      stop: recognition.stop,
      listenOnce,
      speak,
      register,
    }),
    [recognition.supported, recognition.listening, recognition.interim, recognition.error, recognition.stop, start, listenOnce, speak, register],
  );

  return <VoiceContext value={value}>{children}</VoiceContext>;
}
