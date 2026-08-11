"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle, Building2, CreditCard, LifeBuoy, Package, Plus, Receipt, TrendingUp, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PlatformPulse } from "@/components/super-admin/platform-pulse";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSchoolList } from "@/lib/hooks/api/use-platform-schools";
import { useSubscriptionList } from "@/lib/hooks/api/use-subscriptions";
import { useSisStore } from "@/lib/hooks/use-store";
import { platformPulse, saasSummary, tenantHealth } from "@/lib/selectors/saas-brief";
import { tenantStatusLabels, tenantStatusTone } from "@/lib/types/saas";
import { formatMinor } from "@/lib/finance/format-minor";
import { formatDate } from "@/lib/utils";

export default function SaasDashboard() {
  const db = useSisStore();
  const { can } = usePermissions();
  // Real "Setup pending" count from PostgreSQL (SA-3, §12). Other dashboard
  // metrics remain mock until their own SA phases.
  const setupPendingQuery = useSchoolList({ status: "setup-pending", pageSize: 1 });
  // Real subscription counts from PostgreSQL (SA-4B, §22). MRR/ARR/overdue/etc.
  // stay mock until their own data foundations exist.
  const activeSubsQuery = useSubscriptionList({ status: "active", pageSize: 1 });
  const trialingSubsQuery = useSubscriptionList({ status: "trialing", pageSize: 1 });
  const summary = useMemo(() => saasSummary(db), [db]);
  const pulse = useMemo(() => platformPulse(db), [db]);
  const attention = useMemo(() => db.saas.tenants.map((t) => ({ t, h: tenantHealth(db.saas, t) })).filter((x) => x.h.state === "at-risk" || x.h.state === "needs-attention").slice(0, 6), [db.saas]);
  const recent = useMemo(() => [...db.saas.tenants].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5), [db.saas.tenants]);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Platform overview</h1><p className="text-xs text-muted-foreground">{summary.totalSchools} schools · all figures are frontend mock data</p></div>
        <div className="flex flex-wrap gap-xs">
          {can("platform.schools.create") && <Button asChild size="sm"><Link href="/super-admin/schools/new"><Plus className="size-3.5" /> Create school</Link></Button>}
          <Button asChild size="sm" variant="outline"><Link href="/super-admin/plans"><Package className="size-3.5" /> Plans</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href="/super-admin/billing"><Wallet className="size-3.5" /> Billing</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-4">
        <StatTile label="Total schools" value={String(summary.totalSchools)} icon={Building2} tone="info" />
        <StatTile label="Active" value={String(summary.activeSchools)} tone="success" />
        <StatTile label="Trialing subs" value={trialingSubsQuery.meta ? String(trialingSubsQuery.meta.total) : "…"} icon={TrendingUp} tone="info" hint="Real DB count" />
        <StatTile label="Setup pending" value={setupPendingQuery.meta ? String(setupPendingQuery.meta.total) : "…"} tone="warning" hint="Real DB count" />
        <StatTile label="Suspended" value={String(summary.suspended)} tone={summary.suspended > 0 ? "error" : "neutral"} />
        <StatTile label="Mock MRR" value={formatMinor(summary.mrrMinor, { compact: true })} icon={Wallet} tone="success" />
        <StatTile label="Mock ARR" value={formatMinor(summary.arrMinor, { compact: true })} tone="success" />
        <StatTile label="Overdue invoices" value={String(summary.overdue)} icon={Receipt} tone={summary.overdue > 0 ? "error" : "success"} />
        <StatTile label="Escalations" value={String(summary.supportEscalations)} icon={LifeBuoy} tone={summary.supportEscalations > 0 ? "warning" : "success"} />
        <StatTile label="Limit warnings" value={String(summary.limitWarnings)} icon={AlertTriangle} tone={summary.limitWarnings > 0 ? "warning" : "success"} />
        <StatTile label="Active subs" value={activeSubsQuery.meta ? String(activeSubsQuery.meta.total) : "…"} icon={CreditCard} tone="info" hint="Real DB count" />
        <StatTile label="New this month" value={String(summary.newThisMonth)} tone="neutral" />
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-md">
          <section className="rounded-lg border border-border bg-surface p-md">
            <div className="mb-sm flex items-center justify-between"><h2 className="text-sm font-semibold text-foreground">Needs attention</h2><Link href="/super-admin/health" className="text-xs text-primary">Tenant health →</Link></div>
            <div className="flex flex-col gap-xs">
              {attention.map(({ t, h }) => (
                <Link key={t.id} href={`/super-admin/schools/${t.id}`} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm transition hover:border-primary/40">
                  <div className="min-w-0"><p className="truncate font-medium text-foreground">{t.name}</p><p className="truncate text-xs text-muted-foreground">{h.reasons[0]}</p></div>
                  <Badge tone={h.state === "at-risk" ? "error" : "warning"}>{h.state === "at-risk" ? "At risk" : "Attention"}</Badge>
                </Link>
              ))}
              {attention.length === 0 && <p className="py-md text-center text-sm text-muted-foreground">All tenants healthy.</p>}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface p-md">
            <div className="mb-sm flex items-center justify-between"><h2 className="text-sm font-semibold text-foreground">Recently added schools</h2><Link href="/super-admin/schools" className="text-xs text-primary">All schools →</Link></div>
            <div className="flex flex-col gap-xs">
              {recent.map((t) => (
                <Link key={t.id} href={`/super-admin/schools/${t.id}`} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm transition hover:border-primary/40">
                  <div className="flex min-w-0 items-center gap-2"><span className="flex size-7 items-center justify-center rounded text-xs font-bold text-white" style={{ background: t.logoColor }}>{t.code.slice(0, 2)}</span><div className="min-w-0"><p className="truncate font-medium text-foreground">{t.name}</p><p className="truncate text-xs text-muted-foreground">{t.domain} · {formatDate(t.createdAt)}</p></div></div>
                  <Badge tone={tenantStatusTone[t.status]}>{tenantStatusLabels[t.status]}</Badge>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <PlatformPulse score={pulse.score} factors={pulse.factors} />
      </div>
    </div>
  );
}
