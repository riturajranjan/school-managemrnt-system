"use client";

import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useAdmin } from "@/lib/hooks/use-admin";
import { roleLabels } from "@/lib/permissions/roles";
import { systemHealthStateLabels, systemHealthStateTone } from "@/lib/types/admin";

export default function SystemHealthPage() {
  const { role, hasServerPermission } = usePermissions();
  const items = useAdmin().systemHealth;
  const canView = hasServerPermission("settings.view");
  if (!canView) return <PermissionDenied action="view system health" role={roleLabels[role]} backHref="/settings" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Activity className="size-5 text-primary" /> System health</h1><p className="text-xs text-muted-foreground">Operational status of platform services (demo)</p></div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <div key={it.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
            <div className="flex items-start justify-between gap-sm">
              <div><p className="text-sm font-semibold text-foreground">{it.label}</p><p className="text-xs text-muted-foreground">{it.category}</p></div>
              <span className="flex items-center gap-1"><span className={`size-2 rounded-full ${it.state === "demo" ? "bg-info" : it.state === "ready-for-integration" ? "bg-warning" : "bg-muted-foreground/50"}`} aria-hidden /><Badge tone={systemHealthStateTone[it.state]}>{systemHealthStateLabels[it.state]}</Badge></span>
            </div>
            <p className="text-xs text-muted-foreground">{it.note}</p>
          </div>
        ))}
      </div>
      <p className="rounded-md border border-border bg-surface-secondary/40 p-sm text-xs text-muted-foreground">Statuses reflect integration readiness, not live uptime. Real monitoring requires connected services.</p>
    </div>
  );
}
