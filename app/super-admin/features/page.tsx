"use client";

import { useMemo, useState } from "react";
import { Blocks, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSisStore } from "@/lib/hooks/use-store";
import { clearEntitlementOverride, setEntitlementOverride } from "@/lib/services/saas-service";
import { entitlementLabels, entitlementTone, type EntitlementLevel } from "@/lib/types/saas";

const LEVELS: EntitlementLevel[] = ["included", "limited", "add-on", "not-available"];

export default function FeaturesPage() {
  const db = useSisStore();
  const [, force] = useState(0);
  const [tenantId, setTenantId] = useState(db.saas.tenants[0]?.id ?? "");

  const tenant = db.saas.tenants.find((t) => t.id === tenantId);
  const plan = tenant ? db.saas.plans.find((p) => p.id === tenant.planId) : undefined;
  const overrides = useMemo(() => db.saas.overrides.filter((o) => o.tenantId === tenantId), [db.saas.overrides, tenantId]);
  const overrideFor = (key: string) => overrides.find((o) => o.featureKey === key);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Blocks className="size-5 text-primary" /> Feature entitlements</h1><p className="text-xs text-muted-foreground">Per-tenant overrides on top of plan defaults</p></div>
        <Select value={tenantId} onValueChange={setTenantId}><SelectTrigger aria-label="School" className="w-56"><SelectValue /></SelectTrigger><SelectContent>{db.saas.tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>
      </div>

      <p className="flex items-start gap-1 rounded-md border border-primary/25 bg-primary/5 p-sm text-xs text-primary"><Info className="mt-0.5 size-3.5 shrink-0" /> Overrides are frontend simulation — they do not enforce real access. {plan && `Defaults from ${plan.name}.`}</p>

      {plan && (
        <div className="flex flex-col gap-xs">
          {plan.features.map((f) => {
            const ov = overrideFor(f.key);
            const effective = ov?.level ?? f.level;
            return (
              <div key={f.key} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0"><div className="flex items-center gap-2"><p className="text-sm font-medium text-foreground">{f.label}</p>{ov && <Badge tone="warning">Override</Badge>}</div><p className="text-xs text-muted-foreground">Plan default: {entitlementLabels[f.level]}{ov ? ` · ${ov.reason}` : ""}</p></div>
                <div className="flex items-center gap-2">
                  <Badge tone={entitlementTone[effective]}>{entitlementLabels[effective]}</Badge>
                  <Select value={effective} onValueChange={(v) => { setEntitlementOverride(tenantId, f.key, v as EntitlementLevel, "Manual override"); force((n) => n + 1); }}>
                    <SelectTrigger aria-label={`${f.label} level`} className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{LEVELS.map((l) => <SelectItem key={l} value={l}>{entitlementLabels[l]}</SelectItem>)}</SelectContent>
                  </Select>
                  {ov && <Button size="sm" variant="ghost" onClick={() => { clearEntitlementOverride(ov.id); force((n) => n + 1); }}>Reset</Button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
