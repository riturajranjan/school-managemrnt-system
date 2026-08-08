"use client";

import Link from "next/link";
import { Network } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useBranches } from "@/lib/hooks/use-admin";
import { roleLabels } from "@/lib/permissions/roles";
import { branchStatusLabels, branchStatusTone } from "@/lib/types/admin";

export default function BranchesPage() {
  const { role } = usePermissions();
  const branches = useBranches();
  const canView = role === "super-admin" || role === "administrator" || role === "principal" || role === "school-owner";
  if (!canView) return <PermissionDenied action="view branches" role={roleLabels[role]} backHref="/settings" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Network className="size-5 text-primary" /> Branches</h1><p className="text-xs text-muted-foreground">{branches.length} branches</p></div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Branches" value={String(branches.length)} tone="info" />
        <StatTile label="Active" value={String(branches.filter((b) => b.status === "active").length)} tone="success" />
        <StatTile label="Setup pending" value={String(branches.filter((b) => b.status === "setup-pending").length)} tone="warning" />
        <StatTile label="Total students" value={String(branches.reduce((s, b) => s + b.studentCount, 0))} tone="neutral" />
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {branches.map((b) => (
          <Link key={b.id} href={`/settings/branches/${b.id}`} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md transition hover:border-primary/40">
            <div className="flex items-start justify-between gap-sm">
              <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{b.name} {b.isPrimary && <span className="text-xs text-primary">· Primary</span>}</p><p className="truncate text-xs text-muted-foreground">{b.code} · {b.city}</p></div>
              <Badge tone={branchStatusTone[b.status]}>{branchStatusLabels[b.status]}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-1 text-center text-xs">
              <div><p className="font-semibold text-foreground">{b.studentCount}</p><p className="text-muted-foreground">Students</p></div>
              <div><p className="font-semibold text-foreground">{b.staffCount}</p><p className="text-muted-foreground">Staff</p></div>
              <div><p className="font-semibold text-foreground">{b.modulesEnabled}</p><p className="text-muted-foreground">Modules</p></div>
            </div>
            <div><div className="mb-0.5 flex justify-between text-[10px] text-muted-foreground"><span>Configuration</span><span>{b.completeness}%</span></div><div className="h-1.5 w-full overflow-hidden rounded-pill bg-surface-secondary"><div className="h-full rounded-pill bg-primary" style={{ width: `${b.completeness}%` }} /></div></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
