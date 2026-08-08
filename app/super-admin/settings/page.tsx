"use client";

import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { usePlatformAdmins, usePlatformSettings } from "@/lib/hooks/use-saas";
import { platformRoleLabels } from "@/lib/types/saas";

export default function PlatformTeamSettingsPage() {
  const admins = usePlatformAdmins();
  const settings = usePlatformSettings();

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Users className="size-5 text-primary" /> Platform team &amp; settings</h1><p className="text-xs text-muted-foreground">Platform admins and global settings</p></div>

      <section>
        <h2 className="mb-sm text-sm font-semibold text-foreground">Team ({admins.length})</h2>
        <div className="flex flex-col gap-xs">
          {admins.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm">
              <div className="flex min-w-0 items-center gap-2"><span className="flex size-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: a.photoColor }}>{a.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}</span><div className="min-w-0"><p className="truncate font-medium text-foreground">{a.name}</p><p className="truncate text-xs text-muted-foreground">{a.email} · {a.scope}</p></div></div>
              <div className="flex items-center gap-2"><Badge tone="neutral">{platformRoleLabels[a.role]}</Badge><Badge tone={a.status === "active" ? "success" : a.status === "invited" ? "info" : "warning"}>{a.status}</Badge></div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-sm text-sm font-semibold text-foreground">Platform settings</h2>
        <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
          <StatTile label="Platform name" value={settings.platformName.split(" ")[0]} tone="neutral" />
          <StatTile label="Default trial" value={`${settings.defaultTrialDays}d`} tone="info" />
          <StatTile label="Grace period" value={`${settings.gracePeriodDays}d`} tone="warning" />
          <StatTile label="Billing cycle" value={settings.defaultBillingCycle} tone="neutral" />
        </div>
        <div className="mt-sm rounded-lg border border-border bg-surface p-md text-sm">
          <dl className="grid grid-cols-1 gap-y-1.5 sm:grid-cols-2">
            <div><dt className="text-xs text-muted-foreground">Support contact</dt><dd className="text-foreground">{settings.supportContact}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Maintenance message</dt><dd className="text-foreground">{settings.maintenanceMessage}</dd></div>
          </dl>
          <div className="mt-sm flex flex-wrap gap-1">{settings.legalLinks.map((l) => <span key={l.label} className="rounded-pill bg-surface-secondary px-2 py-0.5 text-xs text-muted-foreground">{l.label}</span>)}</div>
        </div>
        <p className="mt-sm text-xs text-muted-foreground">Settings are frontend mock — not persisted to a backend.</p>
      </section>
    </div>
  );
}
