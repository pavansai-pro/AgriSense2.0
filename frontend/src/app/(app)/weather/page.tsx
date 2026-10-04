"use client";

import { Droplets, LocateFixed, MapPin, Wind } from "lucide-react";
import { useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { LocationPicker } from "@/components/agri/location-picker";
import { PageHeader } from "@/components/agri/page-header";
import { formatDay, WeatherIcon } from "@/components/agri/weather-icon";
import { useApp } from "@/components/app-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LANGUAGES } from "@/lib/languages";
import type { Forecast, ForecastDay } from "@/lib/types";
import { useCachedQuery } from "@/lib/use-cached-query";

export default function WeatherPage() {
  const { t, user, lang } = useApp();
  const locale = LANGUAGES.find((l) => l.code === lang)?.speech || "en-US";
  const [loc, setLoc] = useState({ state: user?.state ?? "", district: user?.district ?? "" });
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  const query = coords
    ? `lat=${coords.lat.toFixed(3)}&lon=${coords.lon.toFixed(3)}`
    : loc.state
      ? `state=${encodeURIComponent(loc.state)}${loc.district ? `&district=${encodeURIComponent(loc.district)}` : ""}`
      : null;
  
  const { data, loading, error, savedAt } = useCachedQuery<Forecast>(query ? `/api/weather/forecast?days=5&${query}` : null);

  function locate() {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      });
    }
  }

  // Safely construct chart data with validation
  const chart = data?.days
    ? data.days
        .filter((d): d is ForecastDay => d && typeof d.date === "string" && typeof d.tmax === "number" && typeof d.tmin === "number")
        .map((d) => ({
          day: formatDay(d.date, locale),
          max: Math.round(d.tmax * 10) / 10,
          min: Math.round(d.tmin * 10) / 10,
          rain: Math.round((d.precip_mm || 0) * 10) / 10,
        }))
    : [];

  return (
    <>
      <PageHeader title={t("weather")} description={t("forecast5") || "5-day forecast"} />
      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4 pt-6">
          <LocationPicker
            state={loc.state}
            district={loc.district}
            onChange={(v) => {
              setCoords(null);
              setLoc(v);
            }}
          />
          <Button variant="outline" size="lg" onClick={locate} className="self-start">
            <LocateFixed className="mr-2 h-5 w-5" />
            {t("useMyLocation")}
          </Button>
        </CardContent>
      </Card>

      {savedAt && (
        <Alert className="mb-4">
          <AlertDescription>
            {t("offline")} · {new Date(savedAt).toLocaleString(locale)}
          </AlertDescription>
        </Alert>
      )}
      {error && !data && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && !data ? (
        <Skeleton className="h-72" />
      ) : data && data.days && data.days.length > 0 ? (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2" data-speak>
                <MapPin className="h-5 w-5" aria-hidden />
                {data.location}
              </CardTitle>
              <CardDescription>
                {data.provider === "openweather" ? "OpenWeather" : "Open-Meteo"} ·{" "}
                {new Date(data.fetched_at).toLocaleString(locale)}
                {data.baseline && ` · Typical: ${data.baseline.temp_c}°C, ${data.baseline.humidity}% humidity`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chart.length > 0 ? (
                <div className="h-56 w-full" aria-hidden>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chart} margin={{ left: -20, right: 0, top: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                      <YAxis yAxisId="t" tick={{ fontSize: 11 }} unit="°" />
                      <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} unit="mm" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: "rgba(255, 255, 255, 0.95)", border: "1px solid #ccc" }}
                        labelFormatter={(label) => `${label}`}
                      />
                      <Bar yAxisId="r" dataKey="rain" name={t("rain") || "Rain"} fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="t" dataKey="max" name="Max °C" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
                      <Line yAxisId="t" dataKey="min" name="Min °C" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-center text-muted-foreground">{t("noData") || "No data available"}</p>
              )}
            </CardContent>
          </Card>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5" data-testid="forecast-days">
            {data.days.slice(0, 5).map((d, i) => {
              if (!d || typeof d.date !== "string" || typeof d.tmax !== "number") return null;
              return (
                <li key={d.date} className="flex flex-col gap-1 rounded-2xl border bg-card p-3 shadow-sm" {...(i < 3 ? { "data-speak": true } : {})}>
                  <span className="text-sm font-medium">
                    {i === 0 ? "Today" : i === 1 ? "Tomorrow" : formatDay(d.date, locale, { weekday: "short", day: "numeric" })}
                  </span>
                  <div className="flex items-center gap-2">
                    <WeatherIcon condition={d.condition || ""} className="h-8 w-8 text-sky-600" />
                    <span className="text-2xl font-semibold tabular-nums">{Math.round(d.tmax)}°</span>
                    <span className="text-muted-foreground tabular-nums">{Math.round(d.tmin)}°</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{d.condition || "—"}</span>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Droplets className="h-3.5 w-3.5" aria-hidden />
                      {(d.precip_mm || 0).toFixed(1)} mm{d.rain_chance !== null && d.rain_chance !== undefined ? ` · ${d.rain_chance}%` : ""}
                    </span>
                    {d.wind_kmh !== null && d.wind_kmh !== undefined && (
                      <span className="flex items-center gap-1">
                        <Wind className="h-3.5 w-3.5" aria-hidden />
                        {Math.round(d.wind_kmh)} km/h
                      </span>
                    )}
                    {d.humidity !== null && d.humidity !== undefined && <span>{t("humidity") || "Humidity"} {Math.round(d.humidity)}%</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="text-muted-foreground">{t("state") || "Select a state"}…</p>
      )}
    </>
  );
}
