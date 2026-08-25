"use client";

import { useState } from "react";
import { Lock, Tags } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useCustomStatuses } from "@/lib/hooks/use-admin";
import { toggleCustomStatus } from "@/lib/services/admin-service";
import { roleLabels } from "@/lib/permissions/roles";

export default function CustomStatusesPage() {
  const { role, hasServerPermission } = usePermissions();
  const statuses = useCustomStatuses();
  const [, force] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const canManage = hasServerPermission("settings.manage");
  if (!canManage) return <PermissionDenied action="manage statuses" role={roleLabels[role]} backHref="/settings" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Tags className="size-5 text-primary" /> Custom statuses</h1><p className="text-xs text-muted-foreground">Configurable statuses for supported workflows</p></div>
      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-xs text-error">{error}</p>}
      <div className="flex flex-col gap-xs">
        {statuses.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm">
            <div className="flex items-center gap-2"><span className="size-3.5 rounded-full" style={{ background: s.color }} aria-hidden /><span className="font-medium text-foreground">{s.name}</span><Badge tone="neutral">{s.module}</Badge>{s.terminal && <Badge tone="info">Terminal</Badge>}{s.isProtected && <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground"><Lock className="size-3" /> Protected</span>}</div>
            <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={s.active} disabled={s.isProtected} onChange={() => { const r = toggleCustomStatus(s.id); if (!r.ok) setError(r.error); else setError(null); force((n) => n + 1); }} aria-label={`Toggle ${s.name}`} /> {s.active ? "Active" : "Inactive"}</label>
          </div>
        ))}
      </div>
      <p className="rounded-md border border-border bg-surface-secondary/40 p-sm text-xs text-muted-foreground">Core protected statuses (e.g. Active, Archived) cannot be modified — this prevents breaking module logic in the simulation.</p>
    </div>
  );
}
