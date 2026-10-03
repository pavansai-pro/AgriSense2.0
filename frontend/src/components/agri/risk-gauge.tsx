import { cn } from "@/lib/utils";

const COLORS = { low: "text-emerald-600", moderate: "text-amber-500", high: "text-red-600" } as const;

export function RiskGauge({ score, level, label }: { score: number; level: keyof typeof COLORS; label: string }) {
  const r = 52;
  const circumference = Math.PI * r;
  const offset = circumference * (1 - Math.min(100, Math.max(0, score)) / 100);
  return (
    <div className="flex flex-col items-center" role="img" aria-label={`${label}: ${Math.round(score)} / 100`}>
      <svg viewBox="0 0 120 70" className="w-48">
        <path d="M8 62 A52 52 0 0 1 112 62" fill="none" stroke="currentColor" strokeWidth="12" className="text-muted" strokeLinecap="round" />
        <path
          d="M8 62 A52 52 0 0 1 112 62"
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("transition-[stroke-dashoffset] duration-700", COLORS[level])}
        />
      </svg>
      <span className={cn("-mt-8 text-4xl font-bold tabular-nums", COLORS[level])}>{Math.round(score)}</span>
      <span className="text-sm text-muted-foreground">/ 100</span>
    </div>
  );
}

export const LEVEL_BADGE = {
  low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  moderate: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  high: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
} as const;
