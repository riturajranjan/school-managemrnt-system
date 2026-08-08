"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Building2, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSisStore } from "@/lib/hooks/use-store";
import { usePlans, useTenants } from "@/lib/hooks/use-saas";
import { tenantHealth, healthLabels, healthTone } from "@/lib/selectors/saas-brief";
import { tenantStatusLabels, tenantStatusTone, type SaasTenantStatus } from "@/lib/types/saas";
import { cn } from "@/lib/utils";

const STATUSES: (SaasTenantStatus | "all")[] = ["all", "trial", "active", "payment-due", "grace-period", "suspended", "setup-pending", "inactive"];

export default function SchoolsDirectoryPage() {
  const db = useSisStore();
  const tenants = useTenants();
  const plans = usePlans();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SaasTenantStatus | "all">("all");

  const planName = (id: string) => plans.find((p) => p.id === id)?.name ?? "—";
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tenants.filter((t) => (status === "all" ? true : t.status === status)).filter((t) => (q ? t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q) || t.domain.toLowerCase().includes(q) : true));
  }, [tenants, query, status]);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Building2 className="size-5 text-primary" /> Schools</h1><p className="text-xs text-muted-foreground">{rows.length} of {tenants.length} tenants</p></div>
        <Button asChild size="sm"><Link href="/super-admin/onboarding"><Plus className="size-3.5" /> Create school</Link></Button>
      </div>

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search schools, codes, domains…" aria-label="Search schools" className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary" /></div>
      </div>
      <div className="flex flex-wrap gap-1">
        {STATUSES.map((s) => <button key={s} type="button" onClick={() => setStatus(s)} className={cn("rounded-pill px-2.5 py-1 text-xs font-medium transition", status === s ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground")}>{s === "all" ? "All" : tenantStatusLabels[s]}</button>)}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-lg border border-border lg:block">
        <table className="w-full min-w-max text-sm">
          <thead><tr className="border-b border-border bg-surface-secondary/60 text-left text-xs text-muted-foreground"><th className="px-sm py-2">School</th><th className="px-sm py-2">Plan</th><th className="px-sm py-2">Students</th><th className="px-sm py-2">Branches</th><th className="px-sm py-2">Setup</th><th className="px-sm py-2">Usage</th><th className="px-sm py-2">Health</th><th className="px-sm py-2">Status</th></tr></thead>
          <tbody>
            {rows.map((t) => {
              const h = tenantHealth(db.saas, t);
              return (
                <tr key={t.id} className="border-b border-border/60 hover:bg-surface-secondary/30">
                  <td className="px-sm py-2"><Link href={`/super-admin/schools/${t.id}`} className="flex items-center gap-2"><span className="flex size-6 items-center justify-center rounded text-[10px] font-bold text-white" style={{ background: t.logoColor }}>{t.code.slice(0, 2)}</span><span><span className="block font-medium text-primary">{t.name}</span><span className="block text-xs text-muted-foreground">{t.domain}</span></span></Link></td>
                  <td className="px-sm py-2 text-muted-foreground">{planName(t.planId)}</td>
                  <td className="px-sm py-2 tabular-nums text-foreground">{t.students.toLocaleString("en-IN")}</td>
                  <td className="px-sm py-2 tabular-nums text-muted-foreground">{t.branches}</td>
                  <td className="px-sm py-2 tabular-nums text-muted-foreground">{t.setupPercent}%</td>
                  <td className="px-sm py-2 tabular-nums text-muted-foreground">{t.usagePercent}%</td>
                  <td className="px-sm py-2"><Badge tone={healthTone[h.state]}>{healthLabels[h.state]}</Badge></td>
                  <td className="px-sm py-2"><Badge tone={tenantStatusTone[t.status]}>{tenantStatusLabels[t.status]}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile / tablet cards */}
      <div className="flex flex-col gap-xs lg:hidden">
        {rows.map((t) => {
          const h = tenantHealth(db.saas, t);
          return (
            <Link key={t.id} href={`/super-admin/schools/${t.id}`} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="flex items-center justify-between gap-sm">
                <div className="flex min-w-0 items-center gap-2"><span className="flex size-7 items-center justify-center rounded text-[10px] font-bold text-white" style={{ background: t.logoColor }}>{t.code.slice(0, 2)}</span><div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{t.name}</p><p className="truncate text-xs text-muted-foreground">{t.domain}</p></div></div>
                <Badge tone={tenantStatusTone[t.status]}>{tenantStatusLabels[t.status]}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{planName(t.planId)}</span>·<span>{t.students.toLocaleString("en-IN")} students</span>·<span>Setup {t.setupPercent}%</span><Badge tone={healthTone[h.state]}>{healthLabels[h.state]}</Badge></div>
            </Link>
          );
        })}
      </div>
      {rows.length === 0 && <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No schools match your filters.</div>}
    </div>
  );
}
