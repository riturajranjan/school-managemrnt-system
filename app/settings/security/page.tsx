"use client";

import { useState } from "react";
import { Lock, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSecuritySettings } from "@/lib/hooks/use-admin";
import { toggleSecuritySetting } from "@/lib/services/admin-service";
import { roleLabels } from "@/lib/permissions/roles";

export default function SecurityPage() {
  const { role } = usePermissions();
  const settings = useSecuritySettings();
  const [, force] = useState(0);

  const canManage = role === "super-admin" || role === "administrator";
  if (!canManage) return <PermissionDenied action="manage security settings" role={roleLabels[role]} backHref="/settings" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Lock className="size-5 text-primary" /> Security settings</h1><p className="text-xs text-muted-foreground">Policies and access controls</p></div>

      <div className="rounded-md border border-warning/30 bg-warning/8 p-sm text-xs text-warning flex items-start gap-2"><ShieldAlert className="mt-0.5 size-3.5 shrink-0" /> These are UI placeholders. Security is <span className="font-medium">not enforced</span> — backend implementation is required for any of these to take effect.</div>

      <div className="flex flex-col gap-xs">
        {settings.map((s) => (
          <div key={s.key} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><div className="flex items-center gap-2"><p className="text-sm font-medium text-foreground">{s.label}</p>{s.backendRequired && <Badge tone="warning">Backend required</Badge>}</div><p className="text-xs text-muted-foreground">{s.description} · Current: <span className="text-foreground">{s.value}</span></p></div>
            <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={s.enabled} onChange={() => { toggleSecuritySetting(s.key); force((n) => n + 1); }} aria-label={`Toggle ${s.label}`} /> {s.enabled ? "On" : "Off"}</label>
          </div>
        ))}
      </div>
    </div>
  );
}
