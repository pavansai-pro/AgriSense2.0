"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type RecognitionResult = { transcript: string; confidence: number };

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<RecognitionResult> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speak(text: string, lang: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  const voice =
    window.speechSynthesis.getVoices().find((v) => v.lang === lang) ??
    window.speechSynthesis.getVoices().find((v) => v.lang.startsWith(lang.split("-")[0]));
  if (voice) u.voice = voice;
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}

export function useSpeechRecognition(lang: string) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => setSupported(getRecognitionCtor() !== null), []);

  const listen = useCallback(
    () =>
      new Promise<RecognitionResult | null>((resolve) => {
        const Ctor = getRecognitionCtor();
        if (!Ctor) return resolve(null);
        recRef.current?.abort();
        const rec = new Ctor();
        rec.lang = lang;
        rec.interimResults = true;
        rec.continuous = false;
        rec.maxAlternatives = 1;
        let final: RecognitionResult | null = null;
        rec.onresult = (e) => {
          const last = e.results[e.results.length - 1];
          setInterim(last[0].transcript);
          if (last.isFinal) final = { transcript: last[0].transcript, confidence: last[0].confidence };
        };
        rec.onerror = (e) => setError(e.error);
        rec.onend = () => {
          setListening(false);
          setInterim("");
          resolve(final);
        };
        setError(null);
        setListening(true);
        recRef.current = rec;
        rec.start();
      }),
    [lang],
  );

  const stop = useCallback(() => recRef.current?.stop(), []);

  return { supported, listening, interim, error, listen, stop };
}
