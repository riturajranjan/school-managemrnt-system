"use client";

import { useState } from "react";
import { Palette } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSisStore } from "@/lib/hooks/use-store";
import { cn } from "@/lib/utils";

export default function WhiteLabelPage() {
  const db = useSisStore();
  const [tenantId, setTenantId] = useState(db.saas.tenants.find((t) => t.whiteLabel.enabled)?.id ?? db.saas.tenants[0]?.id ?? "");
  const tenant = db.saas.tenants.find((t) => t.id === tenantId);
  const plan = tenant ? db.saas.plans.find((p) => p.id === tenant.planId) : undefined;
  const eligible = plan?.whiteLabel ?? false;
  const wl = tenant?.whiteLabel;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Palette className="size-5 text-primary" /> White-label management</h1><p className="text-xs text-muted-foreground">Per-tenant branding · requires an eligible plan</p></div>
        <Select value={tenantId} onValueChange={setTenantId}><SelectTrigger aria-label="School" className="w-56"><SelectValue /></SelectTrigger><SelectContent>{db.saas.tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>
      </div>

      {!eligible && <p className="rounded-md border border-warning/30 bg-warning/8 p-sm text-xs text-warning">White-label requires the Professional or Enterprise plan. {tenant?.name} is on {plan?.name}. Upgrade or add the white-label add-on to enable these options.</p>}

      {tenant && wl && (
        <div className="grid grid-cols-1 gap-md lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className={cn("flex flex-col gap-sm rounded-lg border border-border bg-surface p-md", !eligible && "opacity-60")}>
            {([["School logo", wl.enabled], ["Hide platform logo", wl.hidePlatformLogo], ["Login branding", wl.loginBranding], ["Email branding", wl.emailBranding], ["Document branding", wl.documentBranding]] as const).map(([label, on]) => (
              <label key={label} className="flex items-center justify-between text-sm"><span className="text-foreground">{label}</span><input type="checkbox" checked={on} disabled={!eligible} readOnly aria-label={label} /></label>
            ))}
            <div className="flex items-center justify-between text-sm"><span className="text-foreground">Accent colour</span><span className="size-6 rounded" style={{ background: wl.accentColor }} /></div>
            <p className="text-xs text-muted-foreground">Toggles reflect current mock configuration; editing white-label is a frontend simulation.</p>
          </div>

          <div className="rounded-lg border border-border bg-surface-secondary/40 p-md">
            <p className="mb-sm text-xs font-semibold text-foreground">Login preview</p>
            <div className="overflow-hidden rounded-lg border border-border bg-white text-neutral-900" style={{ borderTopColor: wl.accentColor, borderTopWidth: 4 }}>
              <div className="p-4 text-center"><span className="mx-auto mb-2 flex size-9 items-center justify-center rounded text-white" style={{ background: wl.accentColor }}>{tenant.code.slice(0, 1)}</span><p className="text-sm font-bold">{tenant.name}</p>{!wl.hidePlatformLogo && <p className="text-[9px] text-neutral-400">Powered by Novyra</p>}<div className="mt-2 space-y-1"><div className="h-6 rounded border border-neutral-200" /><div className="h-6 rounded text-white" style={{ background: wl.accentColor }} /></div></div>
            </div>
            {wl.enabled ? <Badge tone="success" className="mt-sm">White-label active</Badge> : <Badge tone="neutral" className="mt-sm">Platform branding</Badge>}
          </div>
        </div>
      )}
    </div>
  );
}
