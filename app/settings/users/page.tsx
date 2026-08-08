"use client";

import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSystemUsers } from "@/lib/hooks/use-admin";
import { changeUserRole, setUserStatus } from "@/lib/services/admin-service";
import { allRoles, roleLabels, type UserRole } from "@/lib/permissions/roles";
import { systemUserStatusLabels, systemUserStatusTone } from "@/lib/types/admin";
import { formatDateTime } from "@/lib/utils";

export default function UsersPage() {
  const { role } = usePermissions();
  const users = useSystemUsers();
  const [, force] = useState(0);
  const [query, setQuery] = useState("");

  const rows = useMemo(() => { const q = query.trim().toLowerCase(); return q ? users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || roleLabels[u.role].toLowerCase().includes(q)) : users; }, [users, query]);

  const canManage = role === "super-admin" || role === "administrator";
  const canView = canManage || role === "principal" || role === "school-owner";
  if (!canView) return <PermissionDenied action="view users" role={roleLabels[role]} backHref="/settings" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Users className="size-5 text-primary" /> Users & access</h1><p className="text-xs text-muted-foreground">{users.length} accounts · no real authentication in this UI phase</p></div>

      <div className="relative max-w-sm"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search users…" aria-label="Search users" className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary" /></div>

      <div className="flex flex-col gap-xs">
        {rows.map((u) => (
          <div key={u.id} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: u.photoColor }}>{u.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}</span>
              <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{u.name}</p><p className="truncate text-xs text-muted-foreground">{u.email} · {u.branch}</p></div>
            </div>
            <div className="flex flex-wrap items-center gap-xs">
              <Badge tone="neutral">{u.accessLevel}</Badge>
              <Badge tone={systemUserStatusTone[u.status]}>{systemUserStatusLabels[u.status]}</Badge>
              {canManage ? (
                <>
                  <Select value={u.role} onValueChange={(v) => { changeUserRole(u.id, v as UserRole); force((n) => n + 1); }}>
                    <SelectTrigger aria-label="Role" className="h-7 w-44 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{allRoles.map((r) => <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>)}</SelectContent>
                  </Select>
                  {u.status === "suspended" || u.status === "locked" ? <Button size="sm" variant="outline" onClick={() => { setUserStatus(u.id, "active"); force((n) => n + 1); }}>Reactivate</Button> : <Button size="sm" variant="ghost" onClick={() => { setUserStatus(u.id, "suspended"); force((n) => n + 1); }}>Suspend</Button>}
                </>
              ) : <span className="text-xs text-muted-foreground">{roleLabels[u.role]} · {u.lastActive === "—" ? "—" : formatDateTime(u.lastActive)}</span>}
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No users match your search.</div>}
      </div>
    </div>
  );
}
