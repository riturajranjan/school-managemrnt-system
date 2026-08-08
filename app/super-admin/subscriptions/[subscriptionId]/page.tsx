"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSisStore } from "@/lib/hooks/use-store";
import { changePlan, extendTrial, setSubscriptionStatus } from "@/lib/services/saas-service";
import { entitlementLabels, subscriptionStatusLabels, subscriptionStatusTone } from "@/lib/types/saas";
import { formatMinor } from "@/lib/finance/format-minor";
import { formatDate } from "@/lib/utils";

export default function SubscriptionDetailPage({ params }: { params: Promise<{ subscriptionId: string }> }) {
  const { subscriptionId } = use(params);
  const db = useSisStore();
  const [, force] = useState(0);
  const [targetPlan, setTargetPlan] = useState<string>("");

  const sub = db.saas.subscriptions.find((s) => s.id === subscriptionId);
  const tenant = sub ? db.saas.tenants.find((t) => t.id === sub.tenantId) : undefined;
  const currentPlan = sub ? db.saas.plans.find((p) => p.id === sub.planId) : undefined;
  const newPlan = db.saas.plans.find((p) => p.id === targetPlan);

  const changes = useMemo(() => {
    if (!currentPlan || !newPlan) return null;
    const lost = currentPlan.features.filter((f) => { const n = newPlan.features.find((x) => x.key === f.key); return f.level !== "not-available" && (!n || n.level === "not-available"); });
    const gained = newPlan.features.filter((f) => { const c = currentPlan.features.find((x) => x.key === f.key); return f.level !== "not-available" && (!c || c.level === "not-available"); });
    const isDowngrade = newPlan.monthlyPrice < currentPlan.monthlyPrice;
    const prorated = Math.abs(newPlan.monthlyPrice - currentPlan.monthlyPrice) * 100;
    return { lost, gained, isDowngrade, prorated };
  }, [currentPlan, newPlan]);

  if (!sub || !tenant || !currentPlan) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Subscription not found. <Link href="/super-admin/subscriptions" className="text-primary">Back</Link></div>;
  const bump = () => force((n) => n + 1);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href="/super-admin/subscriptions"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h1 className="truncate text-lg font-semibold text-foreground">{tenant.name}</h1><Badge tone={subscriptionStatusTone[sub.status]}>{subscriptionStatusLabels[sub.status]}</Badge></div><p className="text-xs text-muted-foreground">{currentPlan.name} · {sub.billingCycle} · {formatMinor(sub.priceMinor)}</p></div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-xs">
        {sub.status === "trial" && <Button size="sm" variant="outline" onClick={() => { extendTrial(sub.id, 7); bump(); }}><Clock className="size-3.5" /> Extend trial 7 days</Button>}
        {sub.status === "active" && <Button size="sm" variant="ghost" onClick={() => { setSubscriptionStatus(sub.id, "suspended"); bump(); }}>Pause</Button>}
        {sub.status === "suspended" && <Button size="sm" variant="outline" onClick={() => { setSubscriptionStatus(sub.id, "active"); bump(); }}>Resume</Button>}
        {sub.status !== "cancelled" && <Button size="sm" variant="ghost" onClick={() => { setSubscriptionStatus(sub.id, "cancelled"); bump(); }}>Cancel (simulation)</Button>}
      </div>

      {/* Change plan workflow */}
      <section className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Change plan</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground">{currentPlan.name}</span>
          <ArrowRight className="size-4 text-muted-foreground" />
          <Select value={targetPlan} onValueChange={setTargetPlan}><SelectTrigger aria-label="New plan" className="w-44"><SelectValue placeholder="Select new plan" /></SelectTrigger><SelectContent>{db.saas.plans.filter((p) => p.id !== sub.planId).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
        </div>

        {changes && newPlan && (
          <div className="mt-md flex flex-col gap-sm">
            <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
              {changes.gained.length > 0 && <div className="rounded-md border border-success/30 bg-success/5 p-sm"><p className="mb-1 text-xs font-semibold text-success">Gains</p>{changes.gained.map((f) => <p key={f.key} className="text-xs text-muted-foreground">+ {f.label} ({entitlementLabels[f.level]})</p>)}</div>}
              {changes.lost.length > 0 && <div className="rounded-md border border-error/30 bg-error/5 p-sm"><p className="mb-1 text-xs font-semibold text-error">Lost on downgrade</p>{changes.lost.map((f) => <p key={f.key} className="text-xs text-muted-foreground">− {f.label}</p>)}</div>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-sm text-sm">
              <span className="text-muted-foreground">Mock prorated {changes.isDowngrade ? "credit" : "charge"}: <span className="font-medium text-foreground">{formatMinor(changes.prorated)}</span> · Effective next cycle</span>
              <Button size="sm" onClick={() => { changePlan(sub.id, newPlan.id); setTargetPlan(""); bump(); }}>Confirm change (simulation)</Button>
            </div>
          </div>
        )}
      </section>

      <div className="rounded-lg border border-border bg-surface p-md text-sm">
        <dl className="grid grid-cols-2 gap-y-1.5 sm:grid-cols-3">
          <div><dt className="text-xs text-muted-foreground">Started</dt><dd className="text-foreground">{formatDate(sub.startDate)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Renewal</dt><dd className="text-foreground">{formatDate(sub.renewalDate)}</dd></div>
          {sub.trialEndDate && <div><dt className="text-xs text-muted-foreground">Trial ends</dt><dd className="text-foreground">{formatDate(sub.trialEndDate)}</dd></div>}
          <div><dt className="text-xs text-muted-foreground">Discount</dt><dd className="text-foreground">{sub.discountPercent}%</dd></div>
        </dl>
      </div>
    </div>
  );
}
