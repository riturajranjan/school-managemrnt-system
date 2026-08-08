"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Minus, Package, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePlans } from "@/lib/hooks/use-saas";
import { entitlementLabels, entitlementTone } from "@/lib/types/saas";
import { formatMinor } from "@/lib/finance/format-minor";
import { cn } from "@/lib/utils";

export default function PlansPage() {
  const plans = usePlans().filter((p) => p.status !== "archived");
  const [view, setView] = useState<"cards" | "compare">("cards");
  const featureKeys = plans[0]?.features.map((f) => ({ key: f.key, label: f.label })) ?? [];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Package className="size-5 text-primary" /> Subscription plans</h1><p className="text-xs text-muted-foreground">{plans.length} active plans</p></div>
        <div className="flex gap-xs">
          <div className="flex gap-1 rounded-md border border-border bg-surface p-0.5">{(["cards", "compare"] as const).map((v) => <button key={v} type="button" onClick={() => setView(v)} className={cn("rounded px-2.5 py-1 text-xs font-medium capitalize", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{v}</button>)}</div>
          <Button asChild size="sm"><Link href="/super-admin/plans/new"><Plus className="size-3.5" /> New plan</Link></Button>
        </div>
      </div>

      {view === "cards" ? (
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((p) => (
            <div key={p.id} className={cn("surface-3d flex flex-col gap-sm rounded-lg border bg-surface p-md", p.popular ? "border-primary" : "border-border")}>
              {p.popular && <Badge tone="info" className="self-start">Most popular</Badge>}
              <div><p className="text-sm font-semibold text-foreground">{p.name}</p><p className="text-xs text-muted-foreground">{p.description}</p></div>
              <p className="text-xl font-bold text-foreground">{formatMinor(p.monthlyPrice * 100)}<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
              <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                <li>{p.studentLimit >= 100000 ? "Unlimited" : p.studentLimit.toLocaleString("en-IN")} students</li>
                <li>{p.staffLimit >= 100000 ? "Unlimited" : p.staffLimit} staff</li>
                <li>{p.branchLimit} branch{p.branchLimit > 1 ? "es" : ""}</li>
                <li>{p.storageGb} GB storage</li>
                <li className="capitalize">{p.supportLevel} support</li>
                <li>{p.whiteLabel ? "White-label ✓" : "No white-label"}</li>
              </ul>
              <div className="mt-auto flex items-center justify-between"><span className="text-xs text-muted-foreground">{p.tenantCount} schools</span><Button asChild size="sm" variant="outline"><Link href={`/super-admin/plans/${p.id}`}>Edit</Link></Button></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-max text-sm">
            <thead><tr className="border-b border-border bg-surface-secondary/60 text-left text-xs text-muted-foreground"><th className="sticky left-0 bg-surface-secondary/60 px-sm py-2">Feature</th>{plans.map((p) => <th key={p.id} className="px-sm py-2 text-center">{p.name}</th>)}</tr></thead>
            <tbody>
              <Row label="Monthly price" cells={plans.map((p) => formatMinor(p.monthlyPrice * 100))} />
              <Row label="Students" cells={plans.map((p) => p.studentLimit >= 100000 ? "∞" : p.studentLimit.toLocaleString("en-IN"))} />
              <Row label="Staff" cells={plans.map((p) => p.staffLimit >= 100000 ? "∞" : String(p.staffLimit))} />
              <Row label="Branches" cells={plans.map((p) => String(p.branchLimit))} />
              <Row label="Storage" cells={plans.map((p) => `${p.storageGb} GB`)} />
              {featureKeys.map((f) => (
                <tr key={f.key} className="border-b border-border/60">
                  <th scope="row" className="sticky left-0 bg-surface px-sm py-2 text-left font-medium text-foreground">{f.label}</th>
                  {plans.map((p) => { const lvl = p.features.find((x) => x.key === f.key)?.level ?? "not-available"; return <td key={p.id} className="px-sm py-2 text-center">{lvl === "not-available" ? <Minus className="mx-auto size-3.5 text-muted-foreground" /> : lvl === "included" ? <Check className="mx-auto size-4 text-success" /> : <Badge tone={entitlementTone[lvl]}>{entitlementLabels[lvl]}</Badge>}</td>; })}
                </tr>
              ))}
              <Row label="White-label" cells={plans.map((p) => p.whiteLabel ? "✓" : "—")} />
              <Row label="Custom domain" cells={plans.map((p) => p.customDomain ? "✓" : "—")} />
              <Row label="Support" cells={plans.map((p) => p.supportLevel)} />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ label, cells }: { label: string; cells: string[] }) {
  return <tr className="border-b border-border/60"><th scope="row" className="sticky left-0 bg-surface px-sm py-2 text-left font-medium text-foreground">{label}</th>{cells.map((c, i) => <td key={i} className="px-sm py-2 text-center capitalize text-foreground">{c}</td>)}</tr>;
}
