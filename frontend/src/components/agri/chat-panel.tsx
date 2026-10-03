"use client";

import { Bot, Loader2, Mic, Send, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useApp } from "@/components/app-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useVoice } from "@/components/voice-provider";
import { api } from "@/lib/api";
import type { ChatReply } from "@/lib/types";
import { cn } from "@/lib/utils";

type Message = { role: "user" | "assistant"; content: string; sources?: ChatReply["sources"] };

export function ChatPanel({
  context,
  suggestions = [],
  className,
}: {
  context?: Record<string, unknown> | null;
  suggestions?: string[];
  className?: string;
}) {
  const { t, lang, online } = useApp();
  const { listenOnce, speak, supported } = useVoice();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [messages]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: message }]);
    setBusy(true);
    try {
      const reply = await api<ChatReply>("/api/chat", {
        method: "POST",
        json: { message, lang, session_id: sessionId, context: context ?? undefined },
      });
      setSessionId(reply.session_id);
      setMessages((m) => [...m, { role: "assistant", content: reply.answer, sources: reply.sources }]);
      speak(reply.answer);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: e instanceof Error ? e.message : t("error") }]);
    } finally {
      setBusy(false);
    }
  }

  async function dictate() {
    const text = await listenOnce();
    if (text) await send(text);
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <ScrollArea className="h-80 rounded-xl border bg-muted/30 p-3">
        <div className="flex flex-col gap-3" aria-live="polite">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-6 text-center text-muted-foreground">
              <Bot className="size-8" aria-hidden />
              <p>{t("askAssistant")}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <Button key={s} variant="outline" size="sm" onClick={() => void send(s)} disabled={!online}>
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed whitespace-pre-line",
                m.role === "user" ? "self-end bg-primary text-primary-foreground" : "self-start bg-card shadow-sm ring-1 ring-border",
              )}
            >
              {m.content}
              {m.role === "assistant" && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Button variant="ghost" size="icon-sm" onClick={() => speak(m.content)} aria-label={t("readAloud")}>
                    <Volume2 />
                  </Button>
                  {m.sources?.slice(0, 3).map((s) => (
                    <Badge key={s.title} variant="secondary" className="text-[11px]">
                      {s.title}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
          {busy && <Loader2 className="size-5 animate-spin self-start text-muted-foreground" aria-label={t("loading")} />}
          <div ref={endRef} />
        </div>
      </ScrollArea>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("askAssistant")}
          aria-label={t("askAssistant")}
          rows={2}
          className="min-h-12 resize-none text-base"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
        />
        {supported && (
          <Button type="button" variant="outline" size="icon-lg" className="size-12" onClick={() => void dictate()} aria-label={t("tapToSpeak")}>
            <Mic />
          </Button>
        )}
        <Button type="submit" size="icon-lg" className="size-12" disabled={busy || !input.trim() || !online} aria-label={t("send")}>
          <Send />
        </Button>
      </form>
    </div>
  );
}
