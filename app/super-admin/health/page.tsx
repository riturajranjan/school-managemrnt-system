"use client";

// Real tenant health (Super Admin SA-4F). Health is derived server-side from
// real DB signals (school/onboarding/subscription/invoice/payment) via
// GET /api/super-admin/health — no mock store, no fake scores, read-only.
import Link from "next/link";
import { useState } from "react";
import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { useTenantHealthList, useHealthSummary } from "@/lib/hooks/api/use-health";
import { formatPlanPrice } from "@/lib/hooks/api/use-plans";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { healthStateLabel, healthStateTone } from "@/lib/plans/health-state";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const FILTERS = ["all", "critical", "attention", "healthy"] as const;

export default function TenantHealthPage() {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 250);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");

  const summary = useHealthSummary();
  const { data: rows, loading, error, reload } = useTenantHealthList({ pageSize: 100, search: debounced || undefined, healthState: filter, sort: "healthState" });
  const s = summary.data;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Activity className="size-5 text-primary" /> Tenant health
        </h1>
        <p className="text-xs text-muted-foreground">Transparent, rule-based indicators derived from real data — read-only</p>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Healthy" value={s ? String(s.healthy) : "…"} tone="success" />
        <StatTile label="Attention" value={s ? String(s.attention) : "…"} tone="warning" />
        <StatTile label="Critical" value={s ? String(s.critical) : "…"} tone={s && s.critical > 0 ? "error" : "neutral"} />
        <StatTile label="Overdue invoices" value={s ? String(s.overdueInvoices) : "…"} tone={s && s.overdueInvoices > 0 ? "error" : "neutral"} hint={s ? `${formatPlanPrice(s.outstandingAmount, s.currency)} outstanding` : undefined} />
      </div>

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        {/* <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search school, code, tenant…"
          aria-label="Search tenant health"
          className="w-full min-w-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary sm:max-w-xs"
        /> */}
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={cn("rounded-pill px-2.5 py-1 text-xs font-medium transition", filter === f ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground")}>
              {f === "all" ? "All" : healthStateLabel(f)}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load tenant health: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>Retry</Button>
        </div>
      ) : loading && rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-2xl text-center text-sm text-muted-foreground">Loading health…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No schools match your filters.</div>
      ) : (
        <div className="grid grid-cols-1 gap-sm lg:grid-cols-2">
          {rows.map((h) => (
            <div key={h.schoolId} className={cn("rounded-lg border p-md", h.healthState === "critical" ? "border-error/30 bg-error/5" : h.healthState === "attention" ? "border-warning/30 bg-warning/5" : "border-border bg-surface")}>
              <div className="mb-sm flex items-center justify-between gap-sm">
                <Link href={`/super-admin/schools/${h.schoolId}`} className="truncate font-medium text-primary">{h.schoolName}</Link>
                <Badge tone={healthStateTone(h.healthState)}>{healthStateLabel(h.healthState)}</Badge>
              </div>
              <p className="mb-sm text-xs text-muted-foreground">
                {h.tenantName} · {h.plan ?? "No plan"}{h.subscriptionStatus ? ` · ${h.subscriptionStatus}` : ""}
                {h.lastPaymentAt ? ` · last paid ${formatDate(h.lastPaymentAt)}` : ""}
              </p>
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold text-foreground">Reasons</p>
                {h.reasons.map((r) => <p key={r} className="text-xs text-muted-foreground">• {r}</p>)}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="rounded-md border border-border bg-surface-secondary/40 p-sm text-xs text-muted-foreground">
        Health is derived from school status, onboarding, subscription/trial state and invoice/payment signals. Usage-limit and support signals are not included in this phase. Resolve a warning by fixing its source (subscription, invoice, onboarding, or school status).
      </p>
    </div>
  );
}
