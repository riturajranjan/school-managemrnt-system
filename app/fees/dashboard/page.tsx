"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowRight, Calendar, Coins, RefreshCw, TrendingUp, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import { FinancePulseGauge } from "@/components/finance/finance-pulse-gauge";
import { useSisStore } from "@/lib/hooks/use-store";
import { formatMoney } from "@/lib/finance/money";
import { dailyFinanceBrief, financeExceptions } from "@/lib/selectors/finance-brief";
import { totalCollected, totalOutstanding } from "@/lib/selectors/finance-reports";
import { computeFinancePulse } from "@/lib/selectors/finance-pulse";

const severityTone = { high: "error", medium: "warning", low: "neutral" } as const;

export default function FeesDashboardPage() {
  const db = useSisStore();
  const [branch] = useState("main");
  const [refreshTick, setRefreshTick] = useState(0);

  const collected = totalCollected(db);
  const outstanding = totalOutstanding(db);
  const pulse = computeFinancePulse(db);
  const brief = dailyFinanceBrief(db);
  const exceptions = financeExceptions(db);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Finance Command Centre</h1>
          <p className="text-xs text-muted-foreground">Fees overview · updated live from every posted transaction</p>
        </div>
        <div className="flex items-center gap-xs">
          <div className="w-32">
            <Select value={branch} onValueChange={() => {}}>
              <SelectTrigger aria-label="Branch">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main">Main branch</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="outline" onClick={() => setRefreshTick((t) => t + 1)}>
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Total collected" value={formatMoney(collected, { compact: true })} icon={Wallet} tone="success" />
        <StatTile label="Total outstanding" value={formatMoney(outstanding, { compact: true })} icon={Coins} tone={outstanding.minorUnits > 0 ? "warning" : "success"} />
        <StatTile label="Collected today" value={formatMoney(brief.todayCollected, { compact: true })} icon={TrendingUp} tone="neutral" />
        <StatTile label="Due within 7 days" value={String(brief.dueThisWeek)} icon={Calendar} tone={brief.dueThisWeek > 0 ? "warning" : "success"} />
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-3">
        <div className="surface-3d flex flex-col items-center rounded-lg border border-border bg-surface p-md lg:col-span-1">
          <h2 className="mb-sm self-start text-sm font-semibold text-foreground">Finance Pulse</h2>
          <FinancePulseGauge key={refreshTick} score={pulse.score} components={pulse.components} />
        </div>

        <div className="surface-3d rounded-lg border border-border bg-surface p-md lg:col-span-2">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Daily finance brief</h2>
          <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
            <BriefStat label="Collected today" value={formatMoney(brief.todayCollected, { compact: true })} />
            <BriefStat label="Expenses paid today" value={formatMoney(brief.todayExpensePaid, { compact: true })} />
            <BriefStat label="Dues in next 7 days" value={String(brief.dueThisWeek)} />
            <BriefStat label="Pending approvals" value={String(brief.pendingApprovals)} />
          </div>

          <h2 className="mb-sm mt-md text-sm font-semibold text-foreground">Exception feed</h2>
          {exceptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No exceptions right now — everything is reconciled and within threshold.</p>
          ) : (
            <ul className="flex flex-col gap-xs">
              {exceptions.map((exception) => (
                <li key={exception.id}>
                  <Link href={exception.href} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm transition-colors hover:border-primary/40">
                    <div className="flex min-w-0 items-center gap-2">
                      <AlertTriangle className={`size-4 shrink-0 ${exception.severity === "high" ? "text-error" : exception.severity === "medium" ? "text-warning" : "text-muted-foreground"}`} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{exception.label}</p>
                        <p className="truncate text-xs text-muted-foreground">{exception.description}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge tone={severityTone[exception.severity]}>{exception.severity}</Badge>
                      <ArrowRight className="size-3.5 text-muted-foreground" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function BriefStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-secondary p-sm">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
