"use client";

import { useState } from "react";
import { RotateCcw, Server } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useAdmin } from "@/lib/hooks/use-admin";
import { createBackup } from "@/lib/services/admin-service";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDateTime } from "@/lib/utils";

export default function BackupsPage() {
  const { role } = usePermissions();
  const admin = useAdmin();
  const [, force] = useState(0);
  const [restoring, setRestoring] = useState<string | null>(null);

  const canManage = role === "super-admin" || role === "administrator";
  if (!canManage) return <PermissionDenied action="manage backups" role={roleLabels[role]} backHref="/settings" />;

  const last = admin.backups[0];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Server className="size-5 text-primary" /> Backups & restore</h1><p className="text-xs text-muted-foreground">{admin.backups.length} restore points</p></div>
        <Button size="sm" onClick={() => { createBackup(); force((n) => n + 1); }}>Create backup (simulation)</Button>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Last backup" value={last ? formatDateTime(last.createdAt).split(",")[0] : "—"} tone="success" />
        <StatTile label="Frequency" value="Nightly" tone="neutral" hint="placeholder" />
        <StatTile label="Retention" value="14 days" tone="neutral" hint="placeholder" />
        <StatTile label="Restore points" value={String(admin.backups.length)} tone="info" />
      </div>

      <div className="rounded-md border border-warning/30 bg-warning/8 p-sm text-xs text-warning">Backend backup service not connected. Creating or restoring here is a frontend simulation only.</div>

      <div className="flex flex-col gap-xs">
        {admin.backups.map((b) => (
          <div key={b.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm">
            <div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate font-medium text-foreground">{b.label}</p><Badge tone={b.type === "manual" ? "info" : "neutral"}>{b.type}</Badge></div><p className="text-xs text-muted-foreground">{b.sizeMb} MB · {formatDateTime(b.createdAt)}</p></div>
            <Button size="sm" variant="outline" onClick={() => { setRestoring(b.id); setTimeout(() => setRestoring(null), 1200); }} disabled={restoring === b.id}><RotateCcw className="size-3.5" /> {restoring === b.id ? "Restoring…" : "Restore"}</Button>
          </div>
        ))}
      </div>
    </div>
  );
}
