"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { useSisStore } from "@/lib/hooks/use-store";
import { tenantHealth, healthLabels, healthTone, type HealthState } from "@/lib/selectors/saas-brief";
import { cn } from "@/lib/utils";

const FILTERS: (HealthState | "all")[] = ["all", "at-risk", "needs-attention", "healthy", "suspended"];

export default function TenantHealthPage() {
  const db = useSisStore();
  const [filter, setFilter] = useState<HealthState | "all">("all");

  const rows = useMemo(() => db.saas.tenants.map((t) => ({ t, h: tenantHealth(db.saas, t) })), [db.saas]);
  const filtered = filter === "all" ? rows : rows.filter((r) => r.h.state === filter);
  const counts = useMemo(() => ({ healthy: rows.filter((r) => r.h.state === "healthy").length, attention: rows.filter((r) => r.h.state === "needs-attention").length, risk: rows.filter((r) => r.h.state === "at-risk").length, suspended: rows.filter((r) => r.h.state === "suspended").length }), [rows]);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Activity className="size-5 text-primary" /> Tenant health</h1><p className="text-xs text-muted-foreground">Transparent, rule-based indicators — not AI churn prediction</p></div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Healthy" value={String(counts.healthy)} tone="success" />
        <StatTile label="Needs attention" value={String(counts.attention)} tone="warning" />
        <StatTile label="At risk" value={String(counts.risk)} tone={counts.risk > 0 ? "error" : "neutral"} />
        <StatTile label="Suspended" value={String(counts.suspended)} tone="neutral" />
      </div>

      <div className="flex flex-wrap gap-1">{FILTERS.map((f) => <button key={f} type="button" onClick={() => setFilter(f)} className={cn("rounded-pill px-2.5 py-1 text-xs font-medium transition", filter === f ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground")}>{f === "all" ? "All" : healthLabels[f]}</button>)}</div>

      <div className="grid grid-cols-1 gap-sm lg:grid-cols-2">
        {filtered.map(({ t, h }) => (
          <div key={t.id} className={cn("rounded-lg border p-md", h.state === "at-risk" ? "border-error/30 bg-error/5" : h.state === "needs-attention" ? "border-warning/30 bg-warning/5" : "border-border bg-surface")}>
            <div className="mb-sm flex items-center justify-between gap-sm"><Link href={`/super-admin/schools/${t.id}`} className="truncate font-medium text-primary">{t.name}</Link><Badge tone={healthTone[h.state]}>{healthLabels[h.state]}</Badge></div>
            <div className="flex flex-col gap-1"><p className="text-xs font-semibold text-foreground">Reasons</p>{h.reasons.map((r) => <p key={r} className="text-xs text-muted-foreground">• {r}</p>)}</div>
            {h.recommendations.length > 0 && <div className="mt-sm flex flex-col gap-1"><p className="text-xs font-semibold text-foreground">Recommended</p>{h.recommendations.map((r) => <p key={r} className="text-xs text-muted-foreground">→ {r}</p>)}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
