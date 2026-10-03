"use client";

import { Check, Moon, RefreshCw, Sun, Volume2 } from "lucide-react";
import { useTheme } from "next-themes";

import { PageHeader } from "@/components/agri/page-header";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useVoice } from "@/components/voice-provider";
import { api } from "@/lib/api";
import { LANGUAGES } from "@/lib/languages";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { t, lang, setLang, sync, runSync, online, setUser } = useApp();
  const { resolvedTheme, setTheme } = useTheme();
  const { speak, supported } = useVoice();
  const dark = resolvedTheme === "dark";

  function toggleTheme(next: boolean) {
    const theme = next ? "dark" : "light";
    setTheme(theme);
    api<Parameters<typeof setUser>[0]>("/api/auth/me", { method: "PATCH", json: { theme } }).then(setUser).catch(() => {});
  }

  return (
    <>
      <PageHeader title={t("settings")} />
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("language")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5" role="radiogroup" aria-label={t("language")}>
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  role="radio"
                  aria-checked={lang === l.code}
                  onClick={() => setLang(l.code)}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center rounded-xl border-2 p-3 text-lg font-semibold transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    lang === l.code ? "border-primary bg-primary/10" : "border-border hover:bg-accent",
                  )}
                >
                  <span className="flex items-center gap-1">
                    {lang === l.code && <Check className="size-4 text-primary" aria-hidden />}
                    {l.native}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">{l.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("theme")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="dark-mode" className="flex items-center gap-2 text-base">
                {dark ? <Moon className="size-5" /> : <Sun className="size-5" />}
                {t("darkMode")}
              </Label>
              <Switch id="dark-mode" checked={dark} onCheckedChange={toggleTheme} className="scale-125" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("tapToSpeak")}</CardTitle>
            <CardDescription>{supported ? t("help") : t("voiceUnsupported")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="lg" onClick={() => speak(t("help"))}>
              <Volume2 />
              {t("readAloud")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("syncNow")}</CardTitle>
            <CardDescription>
              {sync.pending > 0 ? t("pendingSync", { n: sync.pending }) : t("allSynced")}
              {sync.lastSyncedAt && ` · ${new Date(sync.lastSyncedAt).toLocaleTimeString()}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="lg" onClick={() => void runSync()} disabled={!online || sync.running}>
              <RefreshCw className={cn(sync.running && "animate-spin")} />
              {sync.running ? t("syncing") : t("syncNow")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
