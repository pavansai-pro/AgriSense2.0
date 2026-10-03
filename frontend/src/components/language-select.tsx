"use client";

import { Languages } from "lucide-react";

import { useApp } from "@/components/app-provider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LANGUAGES, type Lang } from "@/lib/languages";

export function LanguageSelect({ className }: { className?: string }) {
  const { lang, setLang, t } = useApp();
  return (
    <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
      <SelectTrigger className={className} aria-label={t("language")} data-testid="language-select">
        <Languages aria-hidden />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LANGUAGES.map((l) => (
          <SelectItem key={l.code} value={l.code}>
            {l.native}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
