"use client";

import { Loader2, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { LocationPicker } from "@/components/agri/location-picker";
import { PageHeader } from "@/components/agri/page-header";
import { useApp } from "@/components/app-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

export default function ProfilePage() {
  const { t, user, setUser, online } = useApp();
  const [form, setForm] = useState({
    name: user?.name ?? "",
    state: user?.state ?? "",
    district: user?.district ?? "",
    acres: user?.acres?.toString() ?? "",
    current_crop: user?.current_crop ?? "",
    pin_code: user?.pin_code ?? "",
  });
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const updated = await api<User>("/api/auth/me", {
        method: "PATCH",
        json: {
          name: form.name,
          state: form.state || null,
          district: form.district || null,
          acres: form.acres ? Number(form.acres) : null,
          current_crop: form.current_crop || null,
          pin_code: form.pin_code || null,
        },
      });
      setUser(updated);
      toast.success(t("saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={t("profile")} />
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Avatar className="size-14">
            <AvatarFallback className="bg-primary text-xl text-primary-foreground">{user?.name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-xl">{user?.name}</CardTitle>
            <CardDescription>{user?.phone ?? user?.email}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="p-name">{t("name")}</Label>
                <Input id="p-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-12 text-base" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="p-crop">{t("selectCrop")}</Label>
                <Input id="p-crop" value={form.current_crop} onChange={(e) => setForm({ ...form, current_crop: e.target.value })} className="h-12 text-base" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="p-acres">{t("acres")}</Label>
                <Input id="p-acres" type="number" min={0} step="any" inputMode="decimal" value={form.acres} onChange={(e) => setForm({ ...form, acres: e.target.value })} className="h-12 text-base" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="p-pin">PIN code</Label>
                <Input id="p-pin" inputMode="numeric" pattern="\d{6}" value={form.pin_code} onChange={(e) => setForm({ ...form, pin_code: e.target.value })} className="h-12 text-base" />
              </div>
            </div>
            <LocationPicker state={form.state} district={form.district} onChange={(v) => setForm({ ...form, ...v })} />
            <Button type="submit" size="lg" className="h-14 text-lg" disabled={busy || !online} data-voice-submit>
              {busy ? <Loader2 className="animate-spin" /> : <Save />}
              {t("save")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
