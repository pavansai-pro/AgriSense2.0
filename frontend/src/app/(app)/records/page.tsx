"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { CheckCircle2, Clock, Save, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/agri/page-header";
import { EMPTY_SOIL, SoilFields, type SoilForm, toSoil } from "@/components/agri/soil-fields";
import { useApp } from "@/components/app-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { LANGUAGES } from "@/lib/languages";
import { db, deleteRecord, type LocalRecord, saveRecord } from "@/lib/offline-db";

type HarvestForm = {
  crop: string;
  variety: string;
  area_acres: string;
  sowing_date: string;
  expected_harvest: string;
  actual_harvest: string;
  yield_quintals: string;
  notes: string;
};

const EMPTY_HARVEST: HarvestForm = {
  crop: "",
  variety: "",
  area_acres: "",
  sowing_date: "",
  expected_harvest: "",
  actual_harvest: "",
  yield_quintals: "",
  notes: "",
};

function SyncBadge({ rec }: { rec: LocalRecord }) {
  const { t } = useApp();
  if (rec.sync_error)
    return (
      <Badge variant="destructive" title={rec.sync_error}>
        <TriangleAlert /> {t("error")}
      </Badge>
    );
  return rec.synced ? (
    <Badge variant="secondary">
      <CheckCircle2 /> {t("saved")}
    </Badge>
  ) : (
    <Badge variant="outline">
      <Clock /> {t("pendingSync", { n: 1 })}
    </Badge>
  );
}

export default function RecordsPage() {
  const { t, lang, online, refreshPending, runSync, user } = useApp();
  const locale = LANGUAGES.find((l) => l.code === lang)!.speech;
  const [soil, setSoil] = useState<SoilForm>(EMPTY_SOIL);
  const [soilNotes, setSoilNotes] = useState("");
  const [harvest, setHarvest] = useState<HarvestForm>({ ...EMPTY_HARVEST, crop: user?.current_crop ?? "" });
  const owner = user?.id ?? -1;
  const records =
    useLiveQuery(() => db.records.where("owner").equals(owner).reverse().sortBy("updated_at"), [owner]) ?? [];
  const visible = records.filter((r) => !r.deleted);

  async function afterSave() {
    await refreshPending();
    toast.success(online ? t("saved") : t("savedOffline"));
    if (online) void runSync();
  }

  async function saveSoil(e: React.FormEvent) {
    e.preventDefault();
    const values = toSoil(soil);
    if (!values) return toast.error(t("voiceFill"));
    await saveRecord("soil_reading", { ...values, notes: soilNotes || null, recorded_at: new Date().toISOString() });
    setSoil(EMPTY_SOIL);
    setSoilNotes("");
    await afterSave();
  }

  async function saveHarvest(e: React.FormEvent) {
    e.preventDefault();
    if (!harvest.crop.trim()) return toast.error(t("selectCrop"));
    const num = (v: string) => (v ? Number(v) : null);
    await saveRecord("harvest_record", {
      crop: harvest.crop.trim(),
      variety: harvest.variety || null,
      area_acres: num(harvest.area_acres),
      sowing_date: harvest.sowing_date || null,
      expected_harvest: harvest.expected_harvest || null,
      actual_harvest: harvest.actual_harvest || null,
      yield_quintals: num(harvest.yield_quintals),
      notes: harvest.notes || null,
    });
    setHarvest(EMPTY_HARVEST);
    await afterSave();
  }

  async function remove(id: string) {
    await deleteRecord(id);
    await refreshPending();
    if (online) void runSync();
  }

  const field = (key: keyof HarvestForm, label: Parameters<typeof t>[0], type = "text") => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`h-${key}`}>{t(label)}</Label>
      <Input
        id={`h-${key}`}
        type={type}
        inputMode={type === "number" ? "decimal" : undefined}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? "any" : undefined}
        value={harvest[key]}
        onChange={(e) => setHarvest({ ...harvest, [key]: e.target.value })}
        className="h-12 text-base"
      />
    </div>
  );

  return (
    <>
      <PageHeader title={t("records")} description={online ? t("allSynced") : t("savedOffline")} />
      <Tabs defaultValue="soil" className="gap-4">
        <TabsList className="h-12 w-full sm:w-auto">
          <TabsTrigger value="soil" className="px-4 text-base">
            {t("soilReadings")}
          </TabsTrigger>
          <TabsTrigger value="harvest" className="px-4 text-base">
            {t("harvestRecords")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="soil" className="flex flex-col gap-4">
          <Card>
            <CardContent>
              <form onSubmit={saveSoil} className="flex flex-col gap-4">
                <SoilFields value={soil} onChange={setSoil} />
                <div className="flex flex-col gap-2">
                  <Label htmlFor="soil-notes">{t("notes")}</Label>
                  <Textarea id="soil-notes" value={soilNotes} onChange={(e) => setSoilNotes(e.target.value)} rows={2} />
                </div>
                <Button type="submit" size="lg" className="h-14 text-lg" data-voice-submit>
                  <Save />
                  {t("saveOffline")}
                </Button>
              </form>
            </CardContent>
          </Card>
          <RecordList
            records={visible.filter((r) => r.kind === "soil_reading")}
            locale={locale}
            onDelete={remove}
            render={(p) => `N ${p.n} · P ${p.p} · K ${p.k} · ${p.moisture}% · ${p.temperature}°C · pH ${p.ph}`}
          />
        </TabsContent>

        <TabsContent value="harvest" className="flex flex-col gap-4">
          <Card>
            <CardContent>
              <form onSubmit={saveHarvest} className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {field("crop", "selectCrop")}
                  {field("variety", "variety")}
                  {field("area_acres", "area", "number")}
                  {field("yield_quintals", "yieldQuintals", "number")}
                  {field("sowing_date", "sowingDate", "date")}
                  {field("expected_harvest", "plannedHarvest", "date")}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="h-notes">{t("notes")}</Label>
                  <Textarea id="h-notes" value={harvest.notes} onChange={(e) => setHarvest({ ...harvest, notes: e.target.value })} rows={2} />
                </div>
                <Button type="submit" size="lg" className="h-14 text-lg">
                  <Save />
                  {t("addHarvest")}
                </Button>
              </form>
            </CardContent>
          </Card>
          <RecordList
            records={visible.filter((r) => r.kind === "harvest_record")}
            locale={locale}
            onDelete={remove}
            render={(p) =>
              [p.crop, p.variety, p.area_acres && `${p.area_acres} ac`, p.yield_quintals && `${p.yield_quintals} q`, p.sowing_date]
                .filter(Boolean)
                .join(" · ")
            }
          />
        </TabsContent>
      </Tabs>
    </>
  );
}

function RecordList({
  records,
  locale,
  onDelete,
  render,
}: {
  records: LocalRecord[];
  locale: string;
  onDelete: (id: string) => void;
  render: (p: Record<string, unknown>) => string;
}) {
  const { t } = useApp();
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{records.length}</CardTitle>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <p className="text-muted-foreground">{t("noData")}</p>
        ) : (
          <ul className="flex flex-col divide-y" data-testid="record-list">
            {records.map((r) => (
              <li key={r.client_id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="truncate font-medium">{render(r.payload)}</span>
                  <span className="text-xs text-muted-foreground">{new Date(r.updated_at).toLocaleString(locale)}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <SyncBadge rec={r} />
                  <Button variant="ghost" size="icon" onClick={() => onDelete(r.client_id)} aria-label="Delete">
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
