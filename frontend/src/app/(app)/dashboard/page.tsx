"use client";

import { ClipboardList, CloudSun, MapPin, ShieldAlert, Sprout } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/agri/page-header";
import { LEVEL_BADGE } from "@/components/agri/risk-gauge";
import { formatDay, WeatherIcon } from "@/components/agri/weather-icon";
import { useApp } from "@/components/app-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { LANGUAGES } from "@/lib/languages";
import type { Dashboard } from "@/lib/types";
import { useCachedQuery } from "@/lib/use-cached-query";
import { cn } from "@/lib/utils";

const TILES = [
  { href: "/crop", key: "crop", icon: Sprout, tone: "bg-emerald-600" },
  { href: "/risk", key: "risk", icon: ShieldAlert, tone: "bg-amber-600" },
  { href: "/weather", key: "weather", icon: CloudSun, tone: "bg-sky-600" },
  { href: "/records", key: "records", icon: ClipboardList, tone: "bg-violet-600" },
] as const;

export default function DashboardPage() {
  const { t, user, lang } = useApp();
  const { data, loading, savedAt } = useCachedQuery<Dashboard>("/api/dashboard");
  const locale = LANGUAGES.find((l) => l.code === lang)!.speech;

  return (
    <>
      <PageHeader title={t("welcome", { name: user?.name ?? "" })} description={t("tagline")} />

      {savedAt && (
        <Alert className="mb-4">
          <AlertDescription>
            {t("offline")} · {new Date(savedAt).toLocaleString(locale)}
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TILES.map(({ href, key, icon: Icon, tone }) => (
          <Link
            key={href}
            href={href}
            className="group flex min-h-28 flex-col items-start justify-between rounded-2xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className={cn("flex size-11 items-center justify-center rounded-xl text-white", tone)}>
              <Icon className="size-6" aria-hidden />
            </span>
            <span className="text-base font-semibold">{t(key)}</span>
          </Link>
        ))}
      </div>

      {loading && !data ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      ) : data ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CloudSun className="size-5" aria-hidden />
                {t("weatherSummary")}
              </CardTitle>
              {data.weather && (
                <CardDescription className="flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden />
                  {data.weather.location}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {data.weather ? (
                <div className="grid grid-cols-5 gap-2" data-speak>
                  {data.weather.days.map((d) => (
                    <div key={d.date} className="flex flex-col items-center gap-1 rounded-xl bg-muted/50 p-2 text-center">
                      <span className="text-xs font-medium text-muted-foreground">{formatDay(d.date, locale)}</span>
                      <WeatherIcon condition={d.condition} className="size-7 text-sky-600" />
                      <span className="text-sm font-semibold tabular-nums">{Math.round(d.tmax)}°</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{Math.round(d.tmin)}°</span>
                      {d.precip_mm > 0.5 && <span className="text-[11px] text-sky-700 dark:text-sky-400">{d.precip_mm.toFixed(0)} mm</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">{t("noData")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("latestRisk")}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.latest_risk ? (
                <div className="flex flex-col gap-3" data-speak>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold">{data.latest_risk.crop}</span>
                    <Badge className={LEVEL_BADGE[data.latest_risk.level as keyof typeof LEVEL_BADGE]}>
                      {t(data.latest_risk.level as "low" | "moderate" | "high")} · {Math.round(data.latest_risk.score)}
                    </Badge>
                  </div>
                  <ul className="list-disc pl-5 text-sm text-muted-foreground">
                    {data.latest_risk.main_causes.slice(0, 3).map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-muted-foreground">{t("noData")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("recentPredictions")}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.recent_predictions.length ? (
                <ul className="flex flex-col gap-3">
                  {data.recent_predictions.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="font-semibold">{p.recommended}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString(locale)} · {p.top.slice(1).map((c) => c.crop).join(", ")}
                        </span>
                      </div>
                      <Badge variant="secondary" className="tabular-nums">
                        {Math.round(p.top[0]?.score ?? 0)}%
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">{t("noData")}</p>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>{t("regionalInsights")}</CardTitle>
              <CardDescription>
                {data.regional_insights.state ?? "—"} · Agricultural census {data.regional_insights.census_year}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.regional_insights.top_crops.length ? (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {data.regional_insights.top_crops.map((c) => (
                    <li key={c.crop} className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{c.crop}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {(c.area_ha / 1000).toLocaleString(locale, { maximumFractionDigits: 0 })}k ha · {c.share_pct.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={Math.min(100, c.share_pct * 2)} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">{t("noData")}</p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
}
