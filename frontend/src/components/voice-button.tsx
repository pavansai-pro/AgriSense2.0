"use client";

import { Mic, MicOff, Square } from "lucide-react";

import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { useVoice } from "@/components/voice-provider";
import { cn } from "@/lib/utils";

export function VoiceButton({ className }: { className?: string }) {
  const { t } = useApp();
  const { supported, listening, interim, start, stop } = useVoice();

  return (
    <div className={cn("pointer-events-none fixed inset-x-0 bottom-5 z-40 flex flex-col items-center gap-2", className)}>
      {listening && (
        <div
          className="pointer-events-auto max-w-[90vw] rounded-full bg-foreground px-4 py-2 text-sm text-background shadow-lg"
          role="status"
          aria-live="assertive"
        >
          {interim || t("listening")}
        </div>
      )}
      <Button
        type="button"
        size="icon"
        onClick={() => (listening ? stop() : void start())}
        aria-label={listening ? t("listening") : t("tapToSpeak")}
        aria-pressed={listening}
        title={supported ? t("tapToSpeak") : t("voiceUnsupported")}
        data-testid="voice-button"
        className={cn(
          "pointer-events-auto size-16 rounded-full shadow-xl ring-4 ring-background [&_svg:not([class*='size-'])]:size-7",
          listening && "animate-pulse bg-destructive text-white hover:bg-destructive/90",
        )}
      >
        {listening ? <Square /> : supported ? <Mic /> : <MicOff />}
      </Button>
      {!listening && (
        <span className="pointer-events-none rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium text-muted-foreground shadow-sm">
          {t("tapToSpeak")}
        </span>
      )}
    </div>
  );
}
