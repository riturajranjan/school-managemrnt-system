"use client";

import Link from "next/link";
import { use, useMemo } from "react";
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSisStore } from "@/lib/hooks/use-store";

export default function TenantOnboardingPage({ params }: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = use(params);
  const db = useSisStore();
  const t = db.saas.tenants.find((x) => x.id === schoolId);
  const plan = t ? db.saas.plans.find((p) => p.id === t.planId) : undefined;

  const checklist = useMemo(() => t ? [
    { label: "School information", done: Boolean(t.name) },
    { label: "Primary admin assigned", done: t.ownerName !== "—" },
    { label: "Plan selected", done: Boolean(plan) },
    { label: "Branches created", done: t.branches > 0 },
    { label: "Domain configured", done: db.saas.domains.some((d) => d.tenantId === t.id && d.status === "active") },
    { label: "Branding configured", done: t.whiteLabel.enabled || t.setupPercent > 50 },
    { label: "Modules selected", done: t.setupPercent > 40 },
    { label: "Students imported", done: t.students > 0 },
  ] : [], [t, plan, db.saas.domains]);

  if (!t) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">School not found. <Link href="/super-admin/onboarding" className="text-primary">Back</Link></div>;
  const done = checklist.filter((c) => c.done).length;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href="/super-admin/schools"><ArrowLeft className="size-4" /></Link></Button>
        <div><h1 className="text-lg font-semibold text-foreground">Onboarding · {t.name}</h1><p className="text-xs text-muted-foreground">{done}/{checklist.length} steps complete · {t.setupPercent}% setup</p></div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <div className="mb-sm h-2 w-full overflow-hidden rounded-pill bg-surface-secondary"><div className="h-full rounded-pill bg-primary" style={{ width: `${t.setupPercent}%` }} /></div>
        <div className="flex flex-col gap-1.5">
          {checklist.map((c) => <div key={c.label} className="flex items-center justify-between gap-2 rounded-md border border-border p-sm text-sm"><span className="flex items-center gap-2">{c.done ? <CheckCircle2 className="size-4 text-success" /> : <Circle className="size-4 text-warning" />}<span className={c.done ? "text-foreground" : "text-muted-foreground"}>{c.label}</span></span>{!c.done && <Badge tone="warning">Pending</Badge>}</div>)}
        </div>
      </div>
      <Button asChild size="sm" variant="outline" className="self-start"><Link href={`/super-admin/schools/${t.id}`}>Open Tenant 360</Link></Button>
    </div>
  );
}
