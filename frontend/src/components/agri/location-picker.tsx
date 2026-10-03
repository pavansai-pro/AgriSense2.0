"use client";

import { useApp } from "@/components/app-provider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Locations } from "@/lib/types";
import { useCachedQuery } from "@/lib/use-cached-query";

export function useLocations() {
  return useCachedQuery<Locations>("/api/meta/locations").data;
}

export function LocationPicker({
  state,
  district,
  onChange,
  showDistrict = true,
}: {
  state: string;
  district: string;
  onChange: (v: { state: string; district: string }) => void;
  showDistrict?: boolean;
}) {
  const { t } = useApp();
  const locations = useLocations();
  const districts = locations?.states.find((s) => s.name === state)?.districts ?? [];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor="loc-state">{t("state")}</Label>
        <Select value={state || undefined} onValueChange={(v) => onChange({ state: v, district: "" })}>
          <SelectTrigger id="loc-state" className="h-12 w-full text-base data-[size=default]:h-12">
            <SelectValue placeholder={t("state")} />
          </SelectTrigger>
          <SelectContent>
            {(locations?.states ?? (state ? [{ name: state, districts: [] }] : [])).map((s) => (
              <SelectItem key={s.name} value={s.name}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {showDistrict && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="loc-district">{t("district")}</Label>
          <Select
            value={district || undefined}
            onValueChange={(v) => onChange({ state, district: v })}
            disabled={districts.length === 0}
          >
            <SelectTrigger id="loc-district" className="h-12 w-full text-base data-[size=default]:h-12">
              <SelectValue placeholder={t("district")} />
            </SelectTrigger>
            <SelectContent>
              {districts.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
