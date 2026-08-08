"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Clock, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSisStore } from "@/lib/hooks/use-store";
import { extendTrial } from "@/lib/services/saas-service";
import { trialRows } from "@/lib/selectors/saas-brief";

export default function TrialsPage() {
  const db = useSisStore();
  const [, force] = useState(0);
  const rows = useMemo(() => trialRows(db), [db]);
  const planName = (id: string) => db.saas.plans.find((p) => p.id === id)?.name ?? id;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><TrendingUp className="size-5 text-primary" /> Trials</h1><p className="text-xs text-muted-foreground">{rows.length} schools in trial or setup</p></div>

      <div className="flex flex-col gap-xs">
        {rows.map(({ tenant, subscription, daysRemaining }) => (
          <div key={tenant.id} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2"><span className="flex size-7 items-center justify-center rounded text-[10px] font-bold text-white" style={{ background: tenant.logoColor }}>{tenant.code.slice(0, 2)}</span><div className="min-w-0"><Link href={`/super-admin/schools/${tenant.id}`} className="truncate text-sm font-medium text-primary">{tenant.name}</Link><p className="truncate text-xs text-muted-foreground">{planName(tenant.planId)} · Owner {tenant.ownerName} · Setup {tenant.setupPercent}%</p></div></div>
            <div className="flex flex-wrap items-center gap-2">
              {daysRemaining != null ? <Badge tone={daysRemaining <= 3 ? "error" : daysRemaining <= 7 ? "warning" : "info"}><Clock className="size-3" /> {daysRemaining < 0 ? "Expired" : `${daysRemaining}d left`}</Badge> : <Badge tone="neutral">Setup</Badge>}
              {subscription && <Button size="sm" variant="outline" onClick={() => { extendTrial(subscription.id, 7); force((n) => n + 1); }}>Extend 7d</Button>}
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No active trials.</div>}
      </div>
    </div>
  );
}
