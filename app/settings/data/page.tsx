"use client";

import Link from "next/link";
import { Database, Download, Server, Upload } from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useAdmin } from "@/lib/hooks/use-admin";
import { roleLabels } from "@/lib/permissions/roles";

export default function DataCentrePage() {
  const { role } = usePermissions();
  const admin = useAdmin();
  const canView = role === "super-admin" || role === "administrator";
  if (!canView) return <PermissionDenied action="view the data centre" role={roleLabels[role]} backHref="/settings" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Database className="size-5 text-primary" /> Data centre</h1><p className="text-xs text-muted-foreground">Imports, exports, backups and retention</p></div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Imports" value={String(admin.imports.length)} icon={Upload} tone="info" />
        <StatTile label="Exports" value={String(admin.exports.length)} icon={Download} tone="neutral" />
        <StatTile label="Backups" value={String(admin.backups.length)} icon={Server} tone="success" />
        <StatTile label="Storage (mock)" value="0.3 GB" tone="neutral" />
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
        <Link href="/settings/import-export" className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-md transition hover:border-primary/40"><span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><Upload className="size-4" /></span><div><p className="text-sm font-semibold text-foreground">Import / Export</p><p className="text-xs text-muted-foreground">Bulk data in & out</p></div></Link>
        <Link href="/settings/backups" className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-md transition hover:border-primary/40"><span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><Server className="size-4" /></span><div><p className="text-sm font-semibold text-foreground">Backups</p><p className="text-xs text-muted-foreground">Snapshots & restore</p></div></Link>
        <Link href="/settings/system-health" className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-md transition hover:border-primary/40"><span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><Database className="size-4" /></span><div><p className="text-sm font-semibold text-foreground">System health</p><p className="text-xs text-muted-foreground">Service status</p></div></Link>
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Data retention (placeholder)</h2>
        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between rounded-md border border-border p-sm"><span className="text-muted-foreground">Archived students</span><span className="text-foreground">Keep 7 years</span></div>
          <div className="flex justify-between rounded-md border border-border p-sm"><span className="text-muted-foreground">Audit logs</span><span className="text-foreground">Keep 3 years</span></div>
          <div className="flex justify-between rounded-md border border-border p-sm"><span className="text-muted-foreground">Financial records</span><span className="text-foreground">Keep 8 years</span></div>
          <div className="flex justify-between rounded-md border border-border p-sm"><span className="text-muted-foreground">Communication logs</span><span className="text-foreground">Keep 1 year</span></div>
        </div>
        <p className="mt-sm text-xs text-muted-foreground">Retention enforcement requires a backend scheduler — values shown are configuration placeholders.</p>
      </div>
    </div>
  );
}
