"use client";

import { CloudOff, RefreshCw, Wifi } from "lucide-react";

import { useApp } from "@/components/app-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function StatusBadge() {
  const { online, sync, runSync, t } = useApp();
  return (
    <div className="flex items-center gap-2" aria-live="polite">
      <Badge
        variant={online ? "secondary" : "destructive"}
        className="h-7 gap-1.5 px-2.5 text-xs"
        data-testid="network-status"
      >
        {online ? <Wifi aria-hidden /> : <CloudOff aria-hidden />}
        {online ? t("online") : t("offline")}
      </Badge>
      {sync.running ? (
        <div className="flex w-24 flex-col gap-1" role="status" aria-label={t("syncing")}>
          <span className="text-[11px] text-muted-foreground">{t("syncing")}</span>
          <Progress value={sync.total ? (sync.done / sync.total) * 100 : 30} className="h-1.5" />
        </div>
      ) : sync.pending > 0 ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void runSync()}
              disabled={!online}
              className="h-7 gap-1 text-xs"
            >
              <RefreshCw aria-hidden />
              {t("pendingSync", { n: sync.pending })}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("syncNow")}</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}
