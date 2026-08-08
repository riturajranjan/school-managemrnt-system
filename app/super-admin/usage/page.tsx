"use client";

import { useMemo, useState } from "react";
import { Activity, Info } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UsageMeter } from "@/components/super-admin/usage-meter";
import { useSisStore } from "@/lib/hooks/use-store";
import { usageKeyLabels } from "@/lib/types/saas";

export default function UsagePage() {
  const db = useSisStore();
  const [tenantId, setTenantId] = useState(db.saas.tenants[0]?.id ?? "");
  const metrics = useMemo(() => db.saas.usage.filter((u) => u.tenantId === tenantId), [db.saas.usage, tenantId]);
  const tenant = db.saas.tenants.find((t) => t.id === tenantId);
  const nearLimit = db.saas.usage.filter((u) => u.limit > 0 && u.used / u.limit >= 0.8);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Activity className="size-5 text-primary" /> Usage & limits</h1><p className="text-xs text-muted-foreground">{nearLimit.length} metrics near or over limit platform-wide</p></div>
        <Select value={tenantId} onValueChange={setTenantId}><SelectTrigger aria-label="School" className="w-56"><SelectValue /></SelectTrigger><SelectContent>{db.saas.tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>
      </div>

      <p className="flex items-start gap-1 rounded-md border border-primary/25 bg-primary/5 p-sm text-xs text-primary"><Info className="mt-0.5 size-3.5 shrink-0" /> Demo/mock usage — no real backend metering. Warnings appear at 80% / 90% / 100%.</p>

      {tenant && (
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          {metrics.map((m) => (
            <div key={m.key} className="rounded-lg border border-border bg-surface p-md">
              <UsageMeter metric={m} />
              <div className="mt-sm">
                <p className="mb-1 text-[11px] text-muted-foreground">6-month trend ({usageKeyLabels[m.key]})</p>
                <div className="flex h-10 items-end gap-1">{m.trend.map((v, i) => { const max = Math.max(...m.trend, 1); return <div key={i} className="flex-1 rounded-t bg-primary/50" style={{ height: `${Math.round((v / max) * 100)}%` }} title={String(v)} />; })}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
