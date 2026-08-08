"use client";

import Link from "next/link";
import { useMemo } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useRolesMeta, useSystemUsers } from "@/lib/hooks/use-admin";
import { roleCapabilityCount } from "@/lib/selectors/admin-brief";
import { accessScopeLabels } from "@/lib/types/admin";
import { roleLabels } from "@/lib/permissions/roles";

export default function RolesPage() {
  const { role } = usePermissions();
  const roles = useRolesMeta();
  const users = useSystemUsers();

  const userCounts = useMemo(() => { const m = new Map<string, number>(); users.forEach((u) => m.set(u.role, (m.get(u.role) ?? 0) + 1)); return m; }, [users]);

  const canView = role === "super-admin" || role === "administrator" || role === "principal";
  if (!canView) return <PermissionDenied action="view roles" role={roleLabels[role]} backHref="/settings" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><ShieldCheck className="size-5 text-primary" /> Roles</h1><p className="text-xs text-muted-foreground">{roles.length} roles</p></div>
        <div className="flex gap-xs"><Button asChild size="sm" variant="outline"><Link href="/settings/permissions"><KeyRound className="size-3.5" /> Permission matrix</Link></Button></div>
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((r) => (
          <div key={r.role} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
            <div className="flex items-start justify-between gap-sm">
              <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{roleLabels[r.role]}</p><p className="line-clamp-2 text-xs text-muted-foreground">{r.description}</p></div>
              <Badge tone={r.isSystem ? "neutral" : "info"}>{r.isSystem ? "System" : "Custom"}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{userCounts.get(r.role) ?? 0} users</span>·<span>{roleCapabilityCount(r.role)} permissions</span>·<span>{accessScopeLabels[r.scope]}</span>
            </div>
            <div className="flex gap-1">
              <Button asChild size="sm" variant="outline"><Link href={`/settings/permissions?role=${r.role}`}>View</Link></Button>
              <Button size="sm" variant="ghost" disabled title="Duplicate (simulation)">Duplicate</Button>
              {r.isSystem && <span className="ml-auto self-center text-[10px] text-muted-foreground">Protected</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
