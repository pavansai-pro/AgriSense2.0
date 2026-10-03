"use client";

import { Loader2, ShieldAlert, ShieldCheck, Umbrella } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ChatPanel } from "@/components/agri/chat-panel";
import { LocationPicker, useLocations } from "@/components/agri/location-picker";
import { PageHeader } from "@/components/agri/page-header";
import { LEVEL_BADGE, RiskGauge } from "@/components/agri/risk-gauge";
import { EMPTY_SOIL, SoilFields, type SoilForm, toSoil } from "@/components/agri/soil-fields";
import { useApp } from "@/components/app-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useVoice, useVoiceHandler } from "@/components/voice-provider";
import { api } from "@/lib/api";
import { saveRecord } from "@/lib/offline-db";
import type { RiskResult } from "@/lib/types";

const FALLBACK_CROPS = ["Cotton", "Groundnut", "Maize", "Potato", "Rice", "Soybean", "Sugarcane", "Tomato", "Wheat"];

function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function RiskPage() {
  const { t, user, lang, online, refreshPending } = useApp();
  const { speak } = useVoice();
  const crops = useLocations()?.crops ?? FALLBACK_CROPS;
  const [soil, setSoil] = useState<SoilForm>(EMPTY_SOIL);
  const [crop, setCrop] = useState(user?.current_crop && FALLBACK_CROPS.includes(user.current_crop) ? user.current_crop : "");
  const [loc, setLoc] = useState({ state: user?.state ?? "", district: user?.district ?? "" });
  const [sowing, setSowing] = useState(() => addDays(-45));
  const [harvest, setHarvest] = useState(() => addDays(60));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RiskResult | null>(null);

  useVoiceHandler((transcript) => {
    const said = transcript.toLowerCase();
    const match = crops.find((c) => said.includes(c.toLowerCase()));
    if (!match || /\d/.test(said)) return false;
    setCrop(match);
    toast.success(`${t("selectCrop")}: ${match}`);
    return true;
  });

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const values = toSoil(soil);
    if (!values || !crop) {
      toast.error(!crop ? t("selectCrop") : t("voiceFill"));
      return;
    }
    if (!online) {
      await saveRecord("soil_reading", { ...values, crop, recorded_at: new Date().toISOString() });
      await refreshPending();
      toast.info(t("savedOffline"));
      speak(t("savedOffline"));
      return;
    }
    setBusy(true);
    try {
      const res = await api<RiskResult>("/api/risk/assess", {
        method: "POST",
        json: {
          ...values,
          crop,
          state: loc.state || null,
          district: loc.district || null,
          sowing_date: sowing,
          planned_harvest: harvest,
          lang,
        },
      });
      setResult(res);
      speak(`${t("riskScore")} ${Math.round(res.score)}. ${t(res.level)}. ${res.main_causes.slice(0, 2).join(". ")}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={t("risk")} />
      <Card className="mb-6">
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2 sm:max-w-xs">
              <Label htmlFor="risk-crop">{t("selectCrop")}</Label>
              <Select value={crop || undefined} onValueChange={setCrop}>
                <SelectTrigger id="risk-crop" className="h-12 w-full text-base data-[size=default]:h-12">
                  <SelectValue placeholder={t("selectCrop")} />
                </SelectTrigger>
                <SelectContent>
                  {crops.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <SoilFields value={soil} onChange={setSoil} />
            <LocationPicker state={loc.state} district={loc.district} onChange={setLoc} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="risk-sowing">{t("sowingDate")}</Label>
                <Input id="risk-sowing" type="date" value={sowing} onChange={(e) => setSowing(e.target.value)} className="h-12 text-base" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="risk-harvest">{t("plannedHarvest")}</Label>
                <Input id="risk-harvest" type="date" value={harvest} onChange={(e) => setHarvest(e.target.value)} className="h-12 text-base" />
              </div>
            </div>
            <Button type="submit" size="lg" className="h-14 text-lg" disabled={busy} data-voice-submit>
              {busy ? <Loader2 className="animate-spin" /> : <ShieldAlert />}
              {online ? t("assess") : t("saveOffline")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <div className="flex flex-col gap-4" aria-live="polite">
          <Card>
            <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-8">
              <RiskGauge score={result.score} level={result.level} label={t("riskScore")} />
              <div className="flex flex-1 flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xl font-semibold">{result.crop}</span>
                  <Badge className={LEVEL_BADGE[result.level]} data-speak>
                    {t(result.level)}
                  </Badge>
                  {result.weather.location && (
                    <span className="text-xs text-muted-foreground">
                      {result.weather.location} · {result.weather.provider}
                    </span>
                  )}
                </div>
                <div>
                  <p className="mb-1 text-sm font-medium">{t("causes")}</p>
                  <ul className="list-disc pl-5 text-[15px]" data-speak>
                    {(result.main_causes.length ? result.main_causes : ["—"]).map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("riskScore")}</CardTitle>
              <CardDescription>0 = safe · 100 = very risky</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {result.factors.map((f) => (
                <div key={f.code} className={f.available ? "" : "opacity-50"}>
                  <div className="mb-1 flex justify-between gap-2 text-sm">
                    <span className="font-medium capitalize">{f.code.replaceAll("_", " ")}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {f.available ? `${Math.round(f.score * 100)}%` : "n/a"} · +{f.contribution.toFixed(1)}
                    </span>
                  </div>
                  <Progress value={f.score * 100} className="h-2" />
                  <p className="mt-1 text-xs text-muted-foreground">{f.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {result.prevention.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="size-5 text-primary" aria-hidden />
                  {t("prevention")}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {result.prevention.map((p) => (
                  <div key={p.title}>
                    <p className="font-medium">{p.title}</p>
                    <p className="text-sm whitespace-pre-line text-muted-foreground" data-speak>
                      {p.text}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Alert>
            <Umbrella />
            <AlertTitle>{t("insurance")}</AlertTitle>
            <AlertDescription>{result.insurance}</AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>{t("assistant")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ChatPanel
                context={result as unknown as Record<string, unknown>}
                suggestions={[`How can I reduce risk for ${result.crop}?`, "What should I do before harvest?"]}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
