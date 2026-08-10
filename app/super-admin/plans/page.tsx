"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Minus, Package, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePlanList, formatPlanPrice } from "@/lib/hooks/api/use-plans";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { usePermissions } from "@/components/providers/permissions-provider";
import { FEATURE_KEYS, FEATURE_LABELS } from "@/lib/plans/features";
import type { StatusTone } from "@/lib/types/common";
import { cn } from "@/lib/utils";

const STATUSES = ["all", "active", "draft", "archived"] as const;
const statusTone: Record<string, StatusTone> = { draft: "neutral", active: "success", archived: "neutral" };
const ALL_FEATURE_KEYS = FEATURE_KEYS;

function limitText(v: number | null): string {
  return v === null ? "Unlimited" : v.toLocaleString("en-IN");
}
function intervalSuffix(i: string): string {
  return i === "yearly" ? "/yr" : "/mo";
}

export default function PlansPage() {
  const { can } = usePermissions();
  const [view, setView] = useState<"cards" | "compare">("cards");
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 250);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");

  const { data: plans, meta, loading, error, reload } = usePlanList({ pageSize: 100, search: debounced || undefined, status, sort: "sortOrder" });
  // Feature rows shown in compare: the union present across the listed plans.
  const featureKeys = ALL_FEATURE_KEYS.filter((k) => plans.some((p) => p.features.includes(k)));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Package className="size-5 text-primary" /> Subscription plans
          </h1>
          <p className="text-xs text-muted-foreground">{meta ? `${meta.total} plans` : "…"}</p>
        </div>
        <div className="flex gap-xs">
          <div className="flex gap-1 rounded-md border border-border bg-surface p-0.5">
            {(["cards", "compare"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn("rounded px-2.5 py-1 text-xs font-medium capitalize", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
              >
                {v}
              </button>
            ))}
          </div>
          {can("platform.plans.manage") && (
            <Button asChild size="sm">
              <Link href="/super-admin/plans/new">
                <Plus className="size-3.5" /> New plan
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search plans, codes…"
          aria-label="Search plans"
          className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-1">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn("rounded-pill px-2.5 py-1 text-xs font-medium capitalize transition", status === s ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground")}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load plans: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : loading && plans.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-2xl text-center text-sm text-muted-foreground">Loading plans…</div>
      ) : plans.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No plans match your filters.</div>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((p) => (
            <div key={p.id} className={cn("surface-3d flex flex-col gap-sm rounded-lg border bg-surface p-md", p.status === "active" ? "border-border" : "border-dashed border-border")}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{p.name}</p>
                <Badge tone={statusTone[p.status] ?? "neutral"}>{p.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{p.description ?? p.code}</p>
              <p className="text-xl font-bold text-foreground">
                {formatPlanPrice(p.price, p.currency)}
                <span className="text-xs font-normal text-muted-foreground">{intervalSuffix(p.billingInterval)}</span>
              </p>
              <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                <li>{limitText(p.limits.maxStudents)} students</li>
                <li>{limitText(p.limits.maxStaff)} staff</li>
                <li>{limitText(p.limits.maxBranches)} branches</li>
                <li>{p.limits.storageGb === null ? "Unlimited" : `${p.limits.storageGb} GB`} storage</li>
                <li>{p.trialDays}-day trial</li>
                {p.supportLevel && <li className="capitalize">{p.supportLevel} support</li>}
                {p.whiteLabel && <li>White-label ✓</li>}
              </ul>
              <div className="mt-auto flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{p.features.length} features</span>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/super-admin/plans/${p.id}`}>{can("platform.plans.manage") ? "Edit" : "View"}</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-secondary/60 text-left text-xs text-muted-foreground">
                <th className="sticky left-0 bg-surface-secondary/60 px-sm py-2">Feature</th>
                {plans.map((p) => (
                  <th key={p.id} className="px-sm py-2 text-center">{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Row label="Price" cells={plans.map((p) => `${formatPlanPrice(p.price, p.currency)}${intervalSuffix(p.billingInterval)}`)} />
              <Row label="Students" cells={plans.map((p) => limitText(p.limits.maxStudents))} />
              <Row label="Staff" cells={plans.map((p) => limitText(p.limits.maxStaff))} />
              <Row label="Branches" cells={plans.map((p) => limitText(p.limits.maxBranches))} />
              <Row label="Storage" cells={plans.map((p) => (p.limits.storageGb === null ? "Unlimited" : `${p.limits.storageGb} GB`))} />
              <Row label="Trial" cells={plans.map((p) => `${p.trialDays} days`)} />
              {featureKeys.map((key) => (
                <tr key={key} className="border-b border-border/60">
                  <th scope="row" className="sticky left-0 bg-surface px-sm py-2 text-left font-medium text-foreground">{FEATURE_LABELS[key] ?? key}</th>
                  {plans.map((p) => (
                    <td key={p.id} className="px-sm py-2 text-center">
                      {p.features.includes(key) ? <Check className="mx-auto size-4 text-success" /> : <Minus className="mx-auto size-3.5 text-muted-foreground" />}
                    </td>
                  ))}
                </tr>
              ))}
              <Row label="White-label" cells={plans.map((p) => (p.whiteLabel ? "✓" : "—"))} />
              <Row label="Support" cells={plans.map((p) => p.supportLevel ?? "—")} />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ label, cells }: { label: string; cells: string[] }) {
  return (
    <tr className="border-b border-border/60">
      <th scope="row" className="sticky left-0 bg-surface px-sm py-2 text-left font-medium text-foreground">{label}</th>
      {cells.map((c, i) => (
        <td key={i} className="px-sm py-2 text-center capitalize text-foreground">{c}</td>
      ))}
    </tr>
  );
}
