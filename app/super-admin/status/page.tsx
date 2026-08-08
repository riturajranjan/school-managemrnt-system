"use client";

import { Server } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePlatformStatus } from "@/lib/hooks/use-saas";
import { platformStatusLabels, platformStatusTone } from "@/lib/types/saas";

export default function PlatformStatusPage() {
  const items = usePlatformStatus();
  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Server className="size-5 text-primary" /> Platform status</h1><p className="text-xs text-muted-foreground">Service status &amp; maintenance</p></div>
      <p className="rounded-md border border-warning/30 bg-warning/8 p-sm text-xs text-warning">Frontend demo status — no live monitoring is connected.</p>
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <div key={it.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
            <div className="flex items-center justify-between gap-sm"><p className="text-sm font-semibold text-foreground">{it.service}</p><span className="flex items-center gap-1"><span className={`size-2 rounded-full ${it.state === "operational" ? "bg-success" : it.state === "degraded" ? "bg-warning" : it.state === "maintenance" ? "bg-warning" : "bg-info"}`} aria-hidden /><Badge tone={platformStatusTone[it.state]}>{platformStatusLabels[it.state]}</Badge></span></div>
            <p className="text-xs text-muted-foreground">{it.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
