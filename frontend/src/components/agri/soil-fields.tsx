"use client";

import { toast } from "sonner";

import { useApp } from "@/components/app-provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useVoiceHandler } from "@/components/voice-provider";
import type { MessageKey } from "@/lib/i18n";
import type { Soil } from "@/lib/types";
import { parseSoilValues } from "@/lib/voice/commands";

export type SoilForm = Record<keyof Soil, string>;

export const EMPTY_SOIL: SoilForm = { n: "", p: "", k: "", moisture: "", temperature: "", ph: "" };

const FIELDS: { key: keyof Soil; label: MessageKey; min: number; max: number; step: number; placeholder: string }[] = [
  { key: "n", label: "nitrogen", min: 0, max: 300, step: 1, placeholder: "90" },
  { key: "p", label: "phosphorus", min: 0, max: 300, step: 1, placeholder: "42" },
  { key: "k", label: "potassium", min: 0, max: 300, step: 1, placeholder: "43" },
  { key: "moisture", label: "moisture", min: 0, max: 100, step: 1, placeholder: "60" },
  { key: "temperature", label: "soilTemp", min: -10, max: 60, step: 0.1, placeholder: "25" },
  { key: "ph", label: "ph", min: 0, max: 14, step: 0.1, placeholder: "6.5" },
];

export function toSoil(form: SoilForm): Soil | null {
  const values = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, Number(v)]));
  return Object.values(form).every((v) => v.trim() !== "" && !Number.isNaN(Number(v))) ? (values as Soil) : null;
}

export function SoilFields({ value, onChange }: { value: SoilForm; onChange: (v: SoilForm) => void }) {
  const { t } = useApp();

  useVoiceHandler((transcript) => {
    const parsed = parseSoilValues(transcript);
    const keys = Object.keys(parsed) as (keyof Soil)[];
    if (keys.length === 0) return false;
    onChange({ ...value, ...Object.fromEntries(keys.map((k) => [k, String(parsed[k])])) });
    toast.success(keys.map((k) => `${t(FIELDS.find((f) => f.key === k)!.label)}: ${parsed[k]}`).join(", "));
    return true;
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {FIELDS.map((f) => (
          <div key={f.key} className="flex flex-col gap-2">
            <Label htmlFor={`soil-${f.key}`} className="text-sm">
              {t(f.label)}
            </Label>
            <Input
              id={`soil-${f.key}`}
              name={f.key}
              type="number"
              inputMode="decimal"
              required
              min={f.min}
              max={f.max}
              step={f.step}
              placeholder={f.placeholder}
              value={value[f.key]}
              onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
              className="h-12 text-lg"
            />
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{t("voiceFill")}</p>
    </div>
  );
}
