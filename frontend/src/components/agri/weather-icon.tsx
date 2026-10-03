import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun } from "lucide-react";

export function WeatherIcon({ condition, className }: { condition: string; className?: string }) {
  const c = condition.toLowerCase();
  const Icon = c.includes("thunder")
    ? CloudLightning
    : c.includes("drizzle")
      ? CloudDrizzle
      : c.includes("rain") || c.includes("shower")
        ? CloudRain
        : c.includes("snow")
          ? CloudSnow
          : c.includes("fog") || c.includes("mist") || c.includes("haze")
            ? CloudFog
            : c.includes("partly") || c.includes("few")
              ? CloudSun
              : c.includes("cloud") || c.includes("overcast")
                ? Cloud
                : Sun;
  return <Icon className={className} aria-hidden />;
}

export function formatDay(iso: string, locale: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric" }) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(locale, opts);
}
