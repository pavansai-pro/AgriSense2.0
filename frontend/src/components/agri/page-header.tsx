"use client";

import { Volume2 } from "lucide-react";

import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { useVoice } from "@/components/voice-provider";

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  const { t } = useApp();
  const { speak } = useVoice();
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl" data-speak>
          {title}
        </h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      <div className="flex items-center gap-2">
        {children}
        <Button
          variant="outline"
          size="lg"
          onClick={() => {
            const text = Array.from(document.querySelectorAll<HTMLElement>("[data-speak]"))
              .map((el) => el.innerText)
              .join(". ");
            speak(text);
          }}
        >
          <Volume2 aria-hidden />
          {t("readAloud")}
        </Button>
      </div>
    </div>
  );
}
