"use client";

import Link from "next/link";
import { AlertTriangle, Building2, CreditCard, LifeBuoy, Package, Plus, Receipt, TrendingUp, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PlatformPulse } from "@/components/super-admin/platform-pulse";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSchoolList } from "@/lib/hooks/api/use-platform-schools";
import { useSubscriptionList } from "@/lib/hooks/api/use-subscriptions";
import { useBillingSummary } from "@/lib/hooks/api/use-billing";
import { useHealthSummary, useTenantHealthList } from "@/lib/hooks/api/use-health";
import { useUsageSummary } from "@/lib/hooks/api/use-usage";
import { useSupportSummary } from "@/lib/hooks/api/use-support";
import { useDashboardSummary } from "@/lib/hooks/api/use-dashboard";
import { formatPlanPrice } from "@/lib/hooks/api/use-plans";
import { healthStateTone, healthStateLabel } from "@/lib/plans/health-state";
import { formatDate } from "@/lib/utils";

export default function SaasDashboard() {
  const { can } = usePermissions();
  // Real school lifecycle counts (SA-4J): total/active/setup-pending/suspended +
  // new-this-month, all from PostgreSQL.
  const schools = useDashboardSummary();
  // Real subscription counts (SA-4B), revenue (SA-4D), health/pulse (SA-4F),
  // usage (SA-4G), support (SA-4I) — every dashboard figure is DB-backed now.
  const activeSubsQuery = useSubscriptionList({ status: "active", pageSize: 1 });
  const trialingSubsQuery = useSubscriptionList({ status: "trialing", pageSize: 1 });
  const billing = useBillingSummary();
  const health = useHealthSummary();
  const usage = useUsageSummary();
  const support = useSupportSummary();
  const attentionQuery = useTenantHealthList({ pageSize: 20, sort: "healthState" });
  const attention = attentionQuery.data.filter((h) => h.healthState !== "healthy").slice(0, 6);
  // Real recently-created schools (SA-4H) — ordered by createdAt desc.
  const recentQuery = useSchoolList({ sort: "createdAt", order: "desc", pageSize: 5 });

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Platform overview</h1><p className="text-xs text-muted-foreground">{schools.data ? `${schools.data.totalSchools} schools` : "…"} · all figures from live PostgreSQL</p></div>
        <div className="flex flex-wrap gap-xs">
          {can("platform.schools.create") && <Button asChild size="sm"><Link href="/super-admin/schools/new"><Plus className="size-3.5" /> Create school</Link></Button>}
          <Button asChild size="sm" variant="outline"><Link href="/super-admin/plans"><Package className="size-3.5" /> Plans</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href="/super-admin/billing"><Wallet className="size-3.5" /> Billing</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-4">
        <StatTile label="Total schools" value={schools.data ? String(schools.data.totalSchools) : "…"} icon={Building2} tone="info" hint="Real DB" />
        <StatTile label="Active" value={schools.data ? String(schools.data.activeSchools) : "…"} tone="success" hint="Real DB" />
        <StatTile label="Trialing subs" value={trialingSubsQuery.meta ? String(trialingSubsQuery.meta.total) : "…"} icon={TrendingUp} tone="info" hint="Real DB count" />
        <StatTile label="Setup pending" value={schools.data ? String(schools.data.setupPendingSchools) : "…"} tone="warning" hint="Real DB" />
        <StatTile label="Suspended" value={schools.data ? String(schools.data.suspendedSchools) : "…"} tone={schools.data && schools.data.suspendedSchools > 0 ? "error" : "neutral"} hint="Real DB" />
        <StatTile label="MRR" value={billing.data ? formatPlanPrice(billing.data.mrr, billing.data.currency) : "…"} icon={Wallet} tone="success" hint="Real DB" />
        <StatTile label="ARR" value={billing.data ? formatPlanPrice(billing.data.arr, billing.data.currency) : "…"} tone="success" hint="Real DB" />
        <StatTile label="Overdue invoices" value={billing.data ? String(billing.data.overdueInvoices) : "…"} icon={Receipt} tone={billing.data && billing.data.overdueInvoices > 0 ? "error" : "success"} hint="Real DB" />
        <StatTile label="Escalations" value={support.data ? String(support.data.escalatedTickets) : "…"} icon={LifeBuoy} tone={support.data && support.data.escalatedTickets > 0 ? "warning" : "success"} hint="Real DB" />
        <StatTile label="Limit warnings" value={usage.data ? String(usage.data.limitWarnings) : "…"} icon={AlertTriangle} tone={usage.data && usage.data.limitWarnings > 0 ? "warning" : "success"} hint="Real DB" />
        <StatTile label="Active subs" value={activeSubsQuery.meta ? String(activeSubsQuery.meta.total) : "…"} icon={CreditCard} tone="info" hint="Real DB count" />
        <StatTile label="New this month" value={schools.data ? String(schools.data.newSchoolsThisMonth) : "…"} tone="neutral" hint="Real DB" />
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-md">
          <section className="rounded-lg border border-border bg-surface p-md">
            <div className="mb-sm flex items-center justify-between"><h2 className="text-sm font-semibold text-foreground">Needs attention</h2><Link href="/super-admin/health" className="text-xs text-primary">Tenant health →</Link></div>
            <div className="flex flex-col gap-xs">
              {attention.map((h) => (
                <Link key={h.schoolId} href={`/super-admin/schools/${h.schoolId}`} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm transition hover:border-primary/40">
                  <div className="min-w-0"><p className="truncate font-medium text-foreground">{h.schoolName}</p><p className="truncate text-xs text-muted-foreground">{h.reasons[0]}</p></div>
                  <Badge tone={healthStateTone(h.healthState)}>{healthStateLabel(h.healthState)}</Badge>
                </Link>
              ))}
              {!attentionQuery.loading && attention.length === 0 && <p className="py-md text-center text-sm text-muted-foreground">All schools healthy.</p>}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface p-md">
            <div className="mb-sm flex items-center justify-between"><h2 className="text-sm font-semibold text-foreground">Recently added schools</h2><Link href="/super-admin/schools" className="text-xs text-primary">All schools →</Link></div>
            <div className="flex flex-col gap-xs">
              {recentQuery.data.map((s) => (
                <Link key={s.id} href={`/super-admin/schools/${s.id}`} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm transition hover:border-primary/40">
                  <div className="flex min-w-0 items-center gap-2"><span className="flex size-7 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">{s.code.slice(0, 2).toUpperCase()}</span><div className="min-w-0"><p className="truncate font-medium text-foreground">{s.name}</p><p className="truncate text-xs text-muted-foreground">{s.tenantName} · {formatDate(s.createdAt)}</p></div></div>
                  <Badge tone={s.status === "active" ? "success" : s.status === "setup-pending" ? "warning" : s.status === "suspended" ? "error" : "neutral"}>{s.status}</Badge>
                </Link>
              ))}
              {!recentQuery.loading && recentQuery.data.length === 0 && <p className="py-md text-center text-sm text-muted-foreground">No schools yet.</p>}
            </div>
          </section>
        </div>

        {health.data ? (
          <PlatformPulse score={health.data.pulse.score} factors={health.data.pulse.factors} />
        ) : (
          <div className="rounded-lg border border-border bg-surface p-md text-center text-sm text-muted-foreground">Loading Platform Pulse…</div>
        )}
      </div>
    </div>
  );
}
