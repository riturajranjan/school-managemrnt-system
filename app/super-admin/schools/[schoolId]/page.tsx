"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatTile } from "@/components/ui/stat-tile";
import { TenantJourney } from "@/components/super-admin/tenant-journey";
import { UsageMeter } from "@/components/super-admin/usage-meter";
import { useImpersonation } from "@/components/super-admin/impersonation";
import { useSisStore } from "@/lib/hooks/use-store";
import { addTenantNote, setTenantStatus } from "@/lib/services/saas-service";
import { tenantHealth, healthLabels, healthTone } from "@/lib/selectors/saas-brief";
import { entitlementLabels, entitlementTone, invoiceStatusLabels, invoiceStatusTone, subscriptionStatusLabels, subscriptionStatusTone, tenantStatusLabels, tenantStatusTone, supportStatusTone } from "@/lib/types/saas";
import { formatMinor } from "@/lib/finance/format-minor";
import { formatDate, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

const TABS = ["Overview", "Subscription", "Usage", "Features", "Domains", "Support", "Billing", "Notes"] as const;

export default function Tenant360Page({ params }: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = use(params);
  const db = useSisStore();
  const impersonation = useImpersonation();
  const [, force] = useState(0);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [note, setNote] = useState("");

  const t = db.saas.tenants.find((x) => x.id === schoolId);
  const plan = t ? db.saas.plans.find((p) => p.id === t.planId) : undefined;
  const sub = t ? db.saas.subscriptions.find((s) => s.tenantId === t.id) : undefined;
  const usage = useMemo(() => (t ? db.saas.usage.filter((u) => u.tenantId === t.id) : []), [db.saas.usage, t]);
  const overrides = useMemo(() => (t ? db.saas.overrides.filter((o) => o.tenantId === t.id) : []), [db.saas.overrides, t]);
  const domains = useMemo(() => (t ? db.saas.domains.filter((d) => d.tenantId === t.id) : []), [db.saas.domains, t]);
  const tickets = useMemo(() => (t ? db.saas.support.filter((s) => s.tenantId === t.id) : []), [db.saas.support, t]);
  const invoices = useMemo(() => (t ? db.saas.invoices.filter((i) => i.tenantId === t.id) : []), [db.saas.invoices, t]);
  const health = t ? tenantHealth(db.saas, t) : null;

  if (!t) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">School not found. <Link href="/super-admin/schools" className="text-primary">Back</Link></div>;

  const bump = () => force((n) => n + 1);
  const overrideFor = (key: string) => overrides.find((o) => o.featureKey === key);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href="/super-admin/schools"><ArrowLeft className="size-4" /></Link></Button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ background: t.logoColor }}>{t.code.slice(0, 2)}</span>
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-lg font-semibold text-foreground">{t.name}</h1><Badge tone={tenantStatusTone[t.status]}>{tenantStatusLabels[t.status]}</Badge>{health && <Badge tone={healthTone[health.state]}>{healthLabels[health.state]}</Badge>}</div><p className="truncate text-xs text-muted-foreground">{t.code} · {t.domain} · {plan?.name} · Owner {t.ownerName}</p></div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-xs">
        <Button size="sm" variant="outline" onClick={() => impersonation.request(t.name)}><Eye className="size-3.5" /> View as School Admin</Button>
        <Button asChild size="sm" variant="outline"><Link href={`/super-admin/subscriptions/${sub?.id ?? ""}`}>Change plan</Link></Button>
        {t.status === "suspended" ? <Button size="sm" variant="outline" onClick={() => { setTenantStatus(t.id, "active"); bump(); }}>Reactivate</Button> : <Button size="sm" variant="ghost" onClick={() => { setTenantStatus(t.id, "suspended"); bump(); }}>Suspend</Button>}
        <Button asChild size="sm" variant="ghost"><Link href="/super-admin/usage">Usage</Link></Button>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((x) => <button key={x} type="button" onClick={() => setTab(x)} className={cn("whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition", tab === x ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{x}</button>)}
      </div>

      {tab === "Overview" && (
        <div className="flex flex-col gap-md">
          <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
            <StatTile label="Setup" value={`${t.setupPercent}%`} tone={t.setupPercent >= 80 ? "success" : "warning"} />
            <StatTile label="Students" value={t.students.toLocaleString("en-IN")} tone="info" />
            <StatTile label="Staff" value={String(t.staff)} tone="neutral" />
            <StatTile label="Branches" value={String(t.branches)} tone="neutral" />
            <StatTile label="Plan" value={plan?.name ?? "—"} tone="info" />
            <StatTile label="Renewal" value={sub ? formatDate(sub.renewalDate) : "—"} tone="neutral" />
            <StatTile label="Open support" value={String(t.supportOpen)} tone={t.supportOpen > 0 ? "warning" : "success"} />
            <StatTile label="Region" value={t.region} tone="neutral" />
          </div>
          <section className="rounded-lg border border-border bg-surface p-md">
            <h2 className="mb-sm text-sm font-semibold text-foreground">Tenant journey</h2>
            <TenantJourney current={t.stage} />
          </section>
          {health && (
            <section className={cn("rounded-lg border p-md", health.state === "at-risk" ? "border-error/30 bg-error/5" : health.state === "needs-attention" ? "border-warning/30 bg-warning/5" : "border-border bg-surface")}>
              <h2 className="mb-sm flex items-center gap-2 text-sm font-semibold text-foreground">Health: <Badge tone={healthTone[health.state]}>{healthLabels[health.state]}</Badge></h2>
              <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
                <div><p className="mb-1 text-xs font-semibold text-foreground">Reasons</p><ul className="space-y-0.5">{health.reasons.map((r) => <li key={r} className="text-xs text-muted-foreground">• {r}</li>)}</ul></div>
                {health.recommendations.length > 0 && <div><p className="mb-1 text-xs font-semibold text-foreground">Recommended</p><ul className="space-y-0.5">{health.recommendations.map((r) => <li key={r} className="text-xs text-muted-foreground">→ {r}</li>)}</ul></div>}
              </div>
            </section>
          )}
        </div>
      )}

      {tab === "Subscription" && sub && plan && (
        <div className="rounded-lg border border-border bg-surface p-md text-sm">
          <div className="mb-sm flex items-center justify-between"><h2 className="text-sm font-semibold text-foreground">{plan.name} · {sub.billingCycle}</h2><Badge tone={subscriptionStatusTone[sub.status]}>{subscriptionStatusLabels[sub.status]}</Badge></div>
          <dl className="grid grid-cols-2 gap-y-1.5 sm:grid-cols-3">
            <div><dt className="text-xs text-muted-foreground">Price</dt><dd className="text-foreground">{formatMinor(sub.priceMinor)}/{sub.billingCycle === "annual" ? "yr" : "mo"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Discount</dt><dd className="text-foreground">{sub.discountPercent}%</dd></div>
            <div><dt className="text-xs text-muted-foreground">Started</dt><dd className="text-foreground">{formatDate(sub.startDate)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Renewal</dt><dd className="text-foreground">{formatDate(sub.renewalDate)}</dd></div>
            {sub.trialEndDate && <div><dt className="text-xs text-muted-foreground">Trial ends</dt><dd className="text-foreground">{formatDate(sub.trialEndDate)}</dd></div>}
          </dl>
          <div className="mt-sm"><Button asChild size="sm" variant="outline"><Link href={`/super-admin/subscriptions/${sub.id}`}>Manage subscription</Link></Button></div>
        </div>
      )}

      {tab === "Usage" && (
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          {usage.map((u) => <div key={u.key} className="rounded-lg border border-border bg-surface p-md"><UsageMeter metric={u} /></div>)}
        </div>
      )}

      {tab === "Features" && plan && (
        <div className="rounded-lg border border-border bg-surface p-md">
          <p className="mb-sm text-xs text-muted-foreground">Entitlements from <span className="font-medium text-foreground">{plan.name}</span>. Overrides are highlighted.</p>
          <div className="grid grid-cols-1 gap-xs sm:grid-cols-2">
            {plan.features.map((f) => {
              const ov = overrideFor(f.key);
              const level = ov?.level ?? f.level;
              return (
                <div key={f.key} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm">
                  <span className="text-foreground">{f.label}{ov && <span className="ml-1 text-[10px] text-warning">· override</span>}</span>
                  <Badge tone={entitlementTone[level]}>{entitlementLabels[level]}</Badge>
                </div>
              );
            })}
          </div>
          {overrides.length > 0 && <p className="mt-sm rounded-md border border-warning/30 bg-warning/8 p-sm text-xs text-warning">Custom entitlement override active — differs from the plan defaults. Manage in <Link href="/super-admin/features" className="underline">Features</Link>.</p>}
        </div>
      )}

      {tab === "Domains" && (
        <div className="flex flex-col gap-xs">
          {domains.map((d) => <div key={d.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm"><div className="min-w-0"><p className="flex items-center gap-1 truncate font-medium text-foreground">{d.domain} <ExternalLink className="size-3 text-muted-foreground" /></p><p className="text-xs text-muted-foreground">{d.type} · SSL {d.sslStatus}</p></div><Badge tone={d.status === "active" ? "success" : d.status === "error" ? "error" : "warning"}>{d.status}</Badge></div>)}
        </div>
      )}

      {tab === "Support" && (
        <div className="flex flex-col gap-xs">
          {tickets.map((tk) => <Link key={tk.id} href={`/super-admin/support/${tk.id}`} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm transition hover:border-primary/40"><div className="min-w-0"><p className="truncate font-medium text-foreground">{tk.subject}</p><p className="truncate text-xs text-muted-foreground">{tk.reference} · {tk.category}</p></div><Badge tone={supportStatusTone[tk.status]}>{tk.status}</Badge></Link>)}
          {tickets.length === 0 && <p className="py-md text-center text-sm text-muted-foreground">No support tickets.</p>}
        </div>
      )}

      {tab === "Billing" && (
        <div className="flex flex-col gap-xs">
          {invoices.map((i) => <Link key={i.id} href="/super-admin/invoices" className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm transition hover:border-primary/40"><div className="min-w-0"><p className="truncate font-medium text-foreground">{i.number}</p><p className="truncate text-xs text-muted-foreground">{formatDate(i.periodStart)} – {formatDate(i.periodEnd)}</p></div><span className="flex items-center gap-2"><span className="text-foreground">{formatMinor(i.totalMinor)}</span><Badge tone={invoiceStatusTone[i.status]}>{invoiceStatusLabels[i.status]}</Badge></span></Link>)}
          {invoices.length === 0 && <p className="py-md text-center text-sm text-muted-foreground">No invoices.</p>}
        </div>
      )}

      {tab === "Notes" && (
        <div className="flex flex-col gap-sm">
          <div className="flex gap-xs"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note…" /><Button size="sm" onClick={() => { if (addTenantNote(t.id, note).ok) { setNote(""); bump(); } }} disabled={!note.trim()}>Add</Button></div>
          <div className="flex flex-col gap-xs">
            {t.notes.map((n) => <div key={n.id} className="rounded-md border border-border bg-surface p-sm text-sm"><p className="text-foreground">{n.text}</p><p className="text-xs text-muted-foreground">{n.by} · {formatDateTime(n.at)}</p></div>)}
            {t.notes.length === 0 && <p className="py-md text-center text-sm text-muted-foreground">No notes yet.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
