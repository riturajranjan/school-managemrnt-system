"use client";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { usePlan } from "@/lib/hooks/use-saas";
import { entitlementLabels, entitlementTone } from "@/lib/types/saas";
import { formatMinor } from "@/lib/finance/format-minor";

export default function PlanDetailPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = use(params);
  const plan = usePlan(planId);
  if (!plan) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Plan not found. <Link href="/super-admin/plans" className="text-primary">Back</Link></div>;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href="/super-admin/plans"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h1 className="truncate text-lg font-semibold text-foreground">{plan.name}</h1>{plan.popular && <Badge tone="info">Popular</Badge>}<Badge tone={plan.status === "active" ? "success" : "neutral"}>{plan.status}</Badge></div><p className="text-xs text-muted-foreground">{plan.description} · {plan.tenantCount} schools</p></div>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Monthly" value={formatMinor(plan.monthlyPrice * 100)} tone="success" />
        <StatTile label="Annual" value={formatMinor(plan.annualPrice * 100)} tone="success" />
        <StatTile label="Students" value={plan.studentLimit >= 100000 ? "∞" : plan.studentLimit.toLocaleString("en-IN")} tone="info" />
        <StatTile label="Staff" value={plan.staffLimit >= 100000 ? "∞" : String(plan.staffLimit)} tone="neutral" />
        <StatTile label="Branches" value={String(plan.branchLimit)} tone="neutral" />
        <StatTile label="Storage" value={`${plan.storageGb} GB`} tone="neutral" />
        <StatTile label="Trial" value={`${plan.trialDays} days`} tone="info" />
        <StatTile label="Support" value={plan.supportLevel} tone="neutral" />
      </div>

      <section className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Feature entitlements</h2>
        <div className="grid grid-cols-1 gap-xs sm:grid-cols-2">
          {plan.features.map((f) => <div key={f.key} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm"><span className="text-foreground">{f.label}</span><Badge tone={entitlementTone[f.level]}>{entitlementLabels[f.level]}</Badge></div>)}
        </div>
      </section>
      <p className="rounded-md border border-border bg-surface-secondary/40 p-sm text-xs text-muted-foreground">Plan editing is a frontend simulation in this UI phase — changes are not persisted to a backend.</p>
    </div>
  );
}
