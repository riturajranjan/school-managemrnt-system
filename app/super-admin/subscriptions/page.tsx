"use client";

// Real subscriptions list (Super Admin SA-4B). Reads GET /api/super-admin/subscriptions
// — real DB rows connecting School + Tenant to a Plan. No mock store.
import Link from "next/link";
import { useState } from "react";
import { CreditCard, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSubscriptionList } from "@/lib/hooks/api/use-subscriptions";
import { formatPlanPrice } from "@/lib/hooks/api/use-plans";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { usePermissions } from "@/components/providers/permissions-provider";
import { subscriptionStatusLabel, subscriptionStatusTone } from "@/lib/plans/subscription-status";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const STATUSES = ["all", "trialing", "active", "past-due", "cancelled", "ended"] as const;

function intervalSuffix(i: string): string {
  return i === "yearly" ? "/yr" : "/mo";
}

export default function SubscriptionsPage() {
  const { can } = usePermissions();
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 250);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");

  const { data: rows, meta, loading, error, reload } = useSubscriptionList({ pageSize: 100, search: debounced || undefined, status, sort: "createdAt", order: "desc" });

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <CreditCard className="size-5 text-primary" /> Subscriptions
          </h1>
          <p className="text-xs text-muted-foreground">{meta ? `${meta.total} subscriptions` : "…"}</p>
        </div>
        {can("platform.subscriptions.manage") && (
          <Button asChild size="sm">
            <Link href="/super-admin/subscriptions/new">
              <Plus className="size-3.5" /> New subscription
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        {/* <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search school, code, tenant…"
          aria-label="Search subscriptions"
          className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary sm:max-w-xs"
        /> */}
        <div className="flex flex-wrap gap-1">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn("rounded-pill px-2.5 py-1 text-xs font-medium transition", status === s ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground")}
            >
              {s === "all" ? "All" : subscriptionStatusLabel(s)}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load subscriptions: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : loading && rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-2xl text-center text-sm text-muted-foreground">Loading subscriptions…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">
          No subscriptions match your filters.
          {can("platform.subscriptions.manage") && (
            <>
              {" "}
              <Link href="/super-admin/subscriptions/new" className="text-primary">
                Assign a plan
              </Link>
              .
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-xs">
          {rows.map((s) => (
            <Link
              key={s.id}
              href={`/super-admin/subscriptions/${s.id}`}
              className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm transition hover:border-primary/40"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{s.school.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {s.plan.name} · {s.tenant.name}
                  {s.status === "trialing" && s.trialEnd
                    ? ` · trial ends ${formatDate(s.trialEnd)}`
                    : ` · renews ${formatDate(s.currentPeriodEnd)}`}
                  {s.cancelAtPeriodEnd ? " · cancels at period end" : ""}
                </p>
              </div>
              <span className="flex items-center gap-2">
                <span className="hidden text-foreground sm:inline">
                  {formatPlanPrice(s.price, s.currency)}
                  <span className="text-xs text-muted-foreground">{intervalSuffix(s.billingInterval)}</span>
                </span>
                <Badge tone={subscriptionStatusTone(s.status)}>{subscriptionStatusLabel(s.status)}</Badge>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
