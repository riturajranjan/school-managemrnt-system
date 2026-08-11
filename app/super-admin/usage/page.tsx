"use client";

// Real usage & limits (Super Admin SA-4G). Usage is derived live from real DB
// rows (students/branches) vs the current subscription's Plan limits via
// GET /api/super-admin/usage — no mock counters, no fake progress. Staff/storage
// are honestly shown as "not tracked yet" (no real backend). Read-only.
import Link from "next/link";
import { useState } from "react";
import { Activity, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { UsageMeter } from "@/components/super-admin/usage-meter";
import { useUsageList, useUsageSummary } from "@/lib/hooks/api/use-usage";
import { usePlanList } from "@/lib/hooks/api/use-plans";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { USAGE_FILTER_STATES, usageStateLabel } from "@/lib/plans/usage-state";
import { cn } from "@/lib/utils";

export default function UsagePage() {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 250);
  const [state, setState] = useState<string>("all");
  const [plan, setPlan] = useState("");

  const summary = useUsageSummary();
  const { data: rows, meta, loading, error, reload } = useUsageList({ pageSize: 100, search: debounced || undefined, state, plan: plan || undefined, sort: "students", order: "desc" });
  const { data: plans } = usePlanList({ pageSize: 100, sort: "sortOrder" });
  const s = summary.data;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Activity className="size-5 text-primary" /> Usage &amp; limits
        </h1>
        <p className="text-xs text-muted-foreground">{meta ? `${meta.total} schools` : "…"} · real consumption vs plan limits</p>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Tracked schools" value={s ? String(s.schoolsTracked) : "…"} tone="info" hint="With a subscription" />
        <StatTile label="Near limit" value={s ? String(s.schoolsWarning) : "…"} tone={s && s.schoolsWarning > 0 ? "warning" : "neutral"} />
        <StatTile label="At limit" value={s ? String(s.schoolsAtLimit) : "…"} tone={s && s.schoolsAtLimit > 0 ? "error" : "neutral"} />
        <StatTile label="Limit warnings" value={s ? String(s.limitWarnings) : "…"} tone={s && s.limitWarnings > 0 ? "warning" : "success"} hint="Students / branches" />
      </div>

      <p className="flex items-start gap-1 rounded-md border border-primary/25 bg-primary/5 p-sm text-xs text-primary">
        <Info className="mt-0.5 size-3.5 shrink-0" /> Students &amp; branches are measured from real records. Staff &amp; storage have no backend yet and are shown as “not tracked”. Warnings appear at 80% / 100%. Visibility only — limits are not enforced on creation in this phase.
      </p>

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search school, code, tenant…"
          aria-label="Search usage"
          className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary sm:max-w-xs"
        />
        <select value={plan} onChange={(e) => setPlan(e.target.value)} aria-label="Filter by plan" className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground">
          <option value="">All plans</option>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="flex flex-wrap gap-1">
          {USAGE_FILTER_STATES.map((f) => (
            <button key={f} type="button" onClick={() => setState(f)} className={cn("rounded-pill px-2.5 py-1 text-xs font-medium transition", state === f ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground")}>
              {f === "all" ? "All" : usageStateLabel(f)}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load usage: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>Retry</Button>
        </div>
      ) : loading && rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-2xl text-center text-sm text-muted-foreground">Loading usage…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No schools match your filters.</div>
      ) : (
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          {rows.map((u) => (
            <div key={u.schoolId} className="rounded-lg border border-border bg-surface p-md">
              <div className="mb-sm flex items-center justify-between gap-sm">
                <Link href={`/super-admin/schools/${u.schoolId}`} className="truncate font-medium text-primary">{u.schoolName}</Link>
                {u.plan ? <Badge tone="info">{u.plan.name}</Badge> : <Badge tone="neutral">No subscription</Badge>}
              </div>
              <p className="mb-sm truncate text-xs text-muted-foreground">{u.tenantName}{u.warnings.length > 0 ? ` · ${u.warnings.join(", ")} near/over limit` : ""}</p>
              <div className="flex flex-col gap-sm">
                {u.metrics.map((m) => <UsageMeter key={m.key} metric={m} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
