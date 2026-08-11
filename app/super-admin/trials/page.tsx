"use client";

// Real trials management (Super Admin SA-4C). Trials are TRIALING (and
// trial-origin) subscriptions read from GET /api/super-admin/trials. Extend /
// convert / end hit the real endpoints — no mock store, no fake timers.
import Link from "next/link";
import { useState } from "react";
import { Clock, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTrialList, extendTrialRequest, convertTrialRequest, endTrialRequest } from "@/lib/hooks/api/use-trials";
import { usePlanList, formatPlanPrice } from "@/lib/hooks/api/use-plans";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { usePermissions } from "@/components/providers/permissions-provider";
import { LIVE_TRIAL_STATES, trialStateLabel, trialStateTone } from "@/lib/plans/trial-state";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const STATES = ["all", "active", "expiring", "expired", "converted", "ended"] as const;

function daysBadge(days: number) {
  if (days < 0) return { tone: "error" as const, text: "Expired" };
  if (days === 0) return { tone: "error" as const, text: "Ends today" };
  if (days <= 3) return { tone: "warning" as const, text: `${days}d left` };
  return { tone: "info" as const, text: `${days}d left` };
}

export default function TrialsPage() {
  const { can } = usePermissions();
  const manage = can("platform.trials.manage");
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 250);
  const [state, setState] = useState<(typeof STATES)[number]>("all");
  const [plan, setPlan] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const { data: rows, meta, loading, error, reload } = useTrialList({ pageSize: 100, search: debounced || undefined, state, plan: plan || undefined, sort: "trialEnd", order: "asc" });
  const { data: plans } = usePlanList({ pageSize: 100, sort: "sortOrder" });

  async function act(id: string, fn: () => Promise<{ success: boolean; error?: { message: string } }>, okText: string) {
    setMsg(null);
    setBusyId(id);
    const res = await fn();
    setBusyId(null);
    if (!res.success) {
      setMsg({ tone: "error", text: res.error?.message ?? "Action failed" });
      return;
    }
    setMsg({ tone: "success", text: okText });
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <TrendingUp className="size-5 text-primary" /> Trials
        </h1>
        <p className="text-xs text-muted-foreground">{meta ? `${meta.total} trials` : "…"}</p>
      </div>

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search school, code, tenant…"
          aria-label="Search trials"
          className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary sm:max-w-xs"
        />
        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          aria-label="Filter by plan"
          className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground"
        >
          <option value="">All plans</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1">
          {STATES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setState(s)}
              className={cn("rounded-pill px-2.5 py-1 text-xs font-medium capitalize transition", state === s ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground")}
            >
              {s === "all" ? "All" : trialStateLabel(s)}
            </button>
          ))}
        </div>
      </div>

      {msg && (
        <p className={msg.tone === "success" ? "rounded-md border border-success/30 bg-success/8 p-sm text-xs text-success" : "rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error"}>
          {msg.text}
        </p>
      )}

      {error ? (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load trials: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : loading && rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-2xl text-center text-sm text-muted-foreground">Loading trials…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No trials match your filters.</div>
      ) : (
        <div className="flex flex-col gap-xs">
          {rows.map((t) => {
            const live = LIVE_TRIAL_STATES.has(t.state);
            const db = daysBadge(t.daysRemaining);
            const busy = busyId === t.subscriptionId;
            return (
              <div key={t.subscriptionId} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/super-admin/schools/${t.school.id}`} className="truncate text-sm font-medium text-primary">{t.school.name}</Link>
                    <Badge tone={trialStateTone(t.state)}>{trialStateLabel(t.state)}</Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {t.plan.name} · {formatPlanPrice(t.plan.price, t.plan.currency)} · {t.tenant.name}
                    {t.trialEnd ? ` · trial ends ${formatDate(t.trialEnd)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {live && (
                    <Badge tone={db.tone}>
                      <Clock className="size-3" /> {db.text}
                    </Badge>
                  )}
                  {manage && live && (
                    <>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => act(t.subscriptionId, () => extendTrialRequest(t.subscriptionId, 7), "Trial extended 7 days.")}>
                        Extend 7d
                      </Button>
                      <Button size="sm" disabled={busy} onClick={() => act(t.subscriptionId, () => convertTrialRequest(t.subscriptionId), "Trial converted to active.")}>
                        Convert
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(t.subscriptionId, () => endTrialRequest(t.subscriptionId), "Trial ended.")}>
                        End
                      </Button>
                    </>
                  )}
                  <Link href={`/super-admin/subscriptions/${t.subscriptionId}`} className="text-xs text-muted-foreground hover:text-foreground">
                    View subscription →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
