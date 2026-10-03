"use client";

import { CalendarRange, Info, Leaf, Loader2, Sprout, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { LocationPicker } from "@/components/agri/location-picker";
import { PageHeader } from "@/components/agri/page-header";
import { EMPTY_SOIL, SoilFields, type SoilForm, toSoil } from "@/components/agri/soil-fields";
import { useApp } from "@/components/app-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useVoice } from "@/components/voice-provider";
import { api } from "@/lib/api";
import { LANGUAGES } from "@/lib/languages";
import { newClientId, saveRecord } from "@/lib/offline-db";
import type { CropPrediction } from "@/lib/types";

export default function CropPage() {
  const { t, user, lang, online, refreshPending } = useApp();
  const { speak } = useVoice();
  const [soil, setSoil] = useState<SoilForm>(EMPTY_SOIL);
  const [loc, setLoc] = useState({ state: user?.state ?? "", district: user?.district ?? "" });
  const [sowing, setSowing] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CropPrediction | null>(null);
  const locale = LANGUAGES.find((l) => l.code === lang)!.speech;

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const values = toSoil(soil);
    if (!values) {
      toast.error(t("voiceFill"));
      return;
    }
    const clientId = newClientId();
    await saveRecord("soil_reading", { ...values, recorded_at: new Date().toISOString() }, clientId);
    await refreshPending();
    if (!online) {
      toast.info(t("savedOffline"));
      speak(t("savedOffline"));
      return;
    }
    setBusy(true);
    try {
      const res = await api<CropPrediction>("/api/crops/predict", {
        method: "POST",
        json: { ...values, state: loc.state || null, sowing_date: sowing || null, client_id: clientId },
      });
      setResult(res);
      const top = res.crops[0];
      speak(`${t("recommended")}: ${top.crop}. ${t("yieldPotential")}: ${top.yield_potential_t_ha} t/ha.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setBusy(false);
    }
  }

  const top = result?.crops[0];

  return (
    <>
      <PageHeader title={t("crop")} />
      <Card className="mb-6">
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-5">
            <SoilFields value={soil} onChange={setSoil} />
            <LocationPicker state={loc.state} district={loc.district} onChange={setLoc} showDistrict={false} />
            <div className="flex flex-col gap-2 sm:max-w-xs">
              <Label htmlFor="sowing">{t("sowingDate")}</Label>
              <Input id="sowing" type="date" value={sowing} onChange={(e) => setSowing(e.target.value)} className="h-12 text-base" />
            </div>
            <Button type="submit" size="lg" className="h-14 text-lg" disabled={busy} data-voice-submit>
              {busy ? <Loader2 className="animate-spin" /> : <Sprout />}
              {online ? t("predict") : t("saveOffline")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && top && (
        <div className="flex flex-col gap-4" aria-live="polite">
          <Card className="border-primary/40 bg-primary/5">
            <CardHeader>
              <CardDescription>{t("recommended")}</CardDescription>
              <CardTitle className="flex items-center gap-2 text-3xl" data-speak>
                <Leaf className="size-7 text-primary" aria-hidden />
                {top.crop}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">{t("yieldPotential")}</p>
                <p className="text-xl font-semibold tabular-nums" data-speak>
                  {top.yield_potential_t_ha} t/ha
                </p>
                <p className="text-xs text-muted-foreground">
                  {top.yield_range_t_ha[0]}–{top.yield_range_t_ha[1]} t/ha
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("harvestWindow")}</p>
                <p className="flex items-center gap-1.5 text-xl font-semibold" data-speak>
                  <CalendarRange className="size-5" aria-hidden />
                  {new Date(top.harvest_window.earliest).toLocaleDateString(locale, { day: "numeric", month: "short" })} –{" "}
                  {new Date(top.harvest_window.latest).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              <div className="flex flex-col items-start gap-2">
                <Badge variant={top.in_season ? "default" : "outline"}>{top.in_season ? t("inSeason") : t("offSeason")}</Badge>
                {top.regional_share_pct !== null && (
                  <span className="text-xs text-muted-foreground">
                    {result.state}: {top.regional_share_pct.toFixed(1)}% of cropped area
                  </span>
                )}
              </div>
              {top.limiting_factors.length > 0 && (
                <Alert className="sm:col-span-3">
                  <TriangleAlert />
                  <AlertTitle>{t("limiting")}</AlertTitle>
                  <AlertDescription>{top.limiting_factors.join(" · ")}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            {result.crops.slice(1).map((c) => (
              <Card key={c.crop} size="sm">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {c.crop}
                    <span className="text-base tabular-nums text-muted-foreground">{Math.round(c.score)}%</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <Progress value={c.score} />
                  <p className="text-sm text-muted-foreground">
                    {c.yield_potential_t_ha} t/ha · {c.in_season ? t("inSeason") : t("offSeason")}
                  </p>
                  {c.limiting_factors.length > 0 && <p className="text-xs text-muted-foreground">{c.limiting_factors.join(" · ")}</p>}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="size-4" aria-hidden />
                {t("modelNote")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
              <p>
                Soil-fit {Math.round(top.components.agronomic.weight * 100)}% · Regional census ({result.model.census_year}){" "}
                {Math.round(top.components.regional.weight * 100)}% · ML model {Math.round(top.components.ml_model.weight * 100)}% (accuracy{" "}
                {(result.model.accuracy * 100).toFixed(1)}% vs {(result.model.chance_accuracy * 100).toFixed(1)}% chance)
              </p>
              {result.model.data_quality_warning && <p className="text-xs">{result.model.data_quality_warning}</p>}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
