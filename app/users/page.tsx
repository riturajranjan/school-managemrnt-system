"use client";

// Users & Access — real User List UI over the hierarchical account
// provisioning foundation (Phase 9W.2 → User List UX pass, now a top-level
// sidebar destination at /users rather than nested under Settings). Every
// list, view, edit, role-change, suspend/reactivate, and password-reset
// action here calls a REAL server endpoint backed by the existing
// provisioning policy, RBAC, and AuditEvent system — no mock actions, no
// client-only authorization, no new permission system, no hard delete
// (Active/Suspended only). The server remains the final authority on every
// action (see lib/server/users/provisioning.ts / account-detail.ts); the UI
// only hides what it already knows the actor cannot do, for UX.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ban, Eye, History, KeyRound, MoreHorizontal, Pencil, Plus, RotateCcw, Search, ShieldCheck, Users } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { ChangePasswordDialog } from "@/components/users/change-password-dialog";
import { useApiResource } from "@/lib/hooks/api/use-api";
import {
  useAccountActivity,
  useAccounts,
  useAllRoleOptions,
  useAssignRole,
  useProvisionableRoles,
  useSetAccountStatus,
  type AccountListItem,
} from "@/lib/hooks/api/use-users-api";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDateTime } from "@/lib/utils";

const ACTIVITY_LABELS: Record<string, string> = {
  USER_ACCOUNT_PROVISIONED: "Account created",
  USER_ACCOUNT_LINKED: "Account linked",
  USER_ROLE_ASSIGNED: "Role assigned",
  USER_ACCOUNT_SUSPENDED: "Account suspended",
  USER_ACCOUNT_ACTIVATED: "Account reactivated",
  PASSWORD_RESET: "Password reset",
  GUARDIAN_INVITED_BY_STUDENT: "Guardian invited",
  STAFF_UPDATED: "Profile updated",
  STUDENT_UPDATED: "Profile updated",
  GUARDIAN_UPDATED: "Profile updated",
};
function activityLabel(action: string): string {
  return ACTIVITY_LABELS[action] ?? action.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

function initials(name: string | null, email: string): string {
  const src = name ?? email;
  return src.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
}

const statusTone: Record<string, "success" | "warning" | "error" | "neutral"> = {
  ACTIVE: "success",
  INVITED: "warning",
  SUSPENDED: "error",
  LOCKED: "error",
  INACTIVE: "neutral",
};

/** Same [•••] row-action affordance DataTable renders on desktop, reused here
 * for the mobile card (DataTable's own rowActions column only renders in its
 * desktop table — mobile cards are fully custom-rendered by the caller). */
function RowActionsMenu<T>({ row, actions }: { row: T; actions: RowAction<T>[] }) {
  const visible = actions.filter((a) => !a.hidden?.(row));
  if (visible.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Row actions"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {visible.map((a) => (
          <DropdownMenuItem key={a.key} onSelect={() => a.onSelect(row)} className={a.destructive ? "text-error" : undefined}>
            {a.icon}
            {a.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function UsersAccessPage() {
  const router = useRouter();
  const { can, role, capabilitiesLoading } = usePermissions();
  const canManage = can("users.manage");

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");

  const { data: rows, meta, reload } = useAccounts({
    search: query || undefined,
    role: roleFilter === "all" ? undefined : roleFilter,
    status: statusFilter === "all" ? undefined : statusFilter,
    branchId: branchFilter === "all" ? undefined : branchFilter,
    pageSize: 100,
  });
  const { data: provisionableRoles } = useProvisionableRoles();
  const { data: allRoles } = useAllRoleOptions();
  const { data: branches } = useApiResource<{ id: string; name: string }[]>("/api/auth/context/branches");
  const { data: currentContext } = useApiResource<{ user: { id: string } }>("/api/auth/context");
  const currentUserId = currentContext?.user.id ?? null;

  const setStatus = useSetAccountStatus();
  const assignRole = useAssignRole();

  const [suspendTarget, setSuspendTarget] = useState<AccountListItem | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<AccountListItem | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<AccountListItem | null>(null);
  const [changeRoleTarget, setChangeRoleTarget] = useState<AccountListItem | null>(null);
  const [changeRoleSelection, setChangeRoleSelection] = useState("");
  const [activityTarget, setActivityTarget] = useState<AccountListItem | null>(null);

  const { data: activity, loading: activityLoading } = useAccountActivity(activityTarget?.id ?? null);

  if (!capabilitiesLoading && !canManage) {
    return <PermissionDenied action="view users & access" role={roleLabels[role]} backHref="/" />;
  }

  const assignableKeys = new Set((provisionableRoles ?? []).map((r) => r.key));
  const isFiltered = query.trim() !== "" || roleFilter !== "all" || statusFilter !== "all" || branchFilter !== "all";

  function clearFilters() {
    setQuery("");
    setRoleFilter("all");
    setStatusFilter("all");
    setBranchFilter("all");
  }

  async function doSuspend() {
    if (!suspendTarget) return;
    const res = await setStatus.run(suspendTarget.id, "SUSPENDED");
    if (res.success) reload();
  }
  async function doReactivate() {
    if (!reactivateTarget) return;
    const res = await setStatus.run(reactivateTarget.id, "ACTIVE");
    if (res.success) reload();
  }
  async function doChangeRole() {
    if (!changeRoleTarget || !changeRoleSelection) return;
    const res = await assignRole.run(changeRoleTarget.id, changeRoleSelection);
    if (res.success) {
      setChangeRoleTarget(null);
      setChangeRoleSelection("");
      reload();
    }
  }

  const rowActions: RowAction<AccountListItem>[] = canManage
    ? [
        { key: "view", label: "View Profile", icon: <Eye className="size-4" />, onSelect: (u) => router.push(`/users/${u.id}`) },
        {
          key: "edit",
          label: "Edit Account",
          icon: <Pencil className="size-4" />,
          onSelect: (u) => router.push(`/users/${u.id}?edit=1`),
          hidden: (u) => !u.staffId && !u.studentId && !u.guardianId,
        },
        {
          key: "change-role",
          label: "Change Role",
          icon: <ShieldCheck className="size-4" />,
          onSelect: (u) => { setChangeRoleTarget(u); setChangeRoleSelection(""); },
          hidden: (u) => assignableKeys.size === 0 || u.id === currentUserId,
        },
        {
          key: "suspend",
          label: "Suspend Account",
          icon: <Ban className="size-4" />,
          destructive: true,
          onSelect: (u) => setSuspendTarget(u),
          hidden: (u) => u.status === "SUSPENDED" || u.id === currentUserId,
        },
        {
          key: "reactivate",
          label: "Reactivate Account",
          icon: <RotateCcw className="size-4" />,
          onSelect: (u) => setReactivateTarget(u),
          hidden: (u) => u.status !== "SUSPENDED",
        },
        { key: "change-password", label: "Change Password", icon: <KeyRound className="size-4" />, onSelect: (u) => setPasswordTarget(u) },
        { key: "activity", label: "View Activity", icon: <History className="size-4" />, onSelect: (u) => setActivityTarget(u) },
      ]
    : [];

  const columns: ColumnDef<AccountListItem>[] = [
    {
      id: "user",
      header: "User",
      alwaysVisible: true,
      sortValue: (u) => u.name ?? u.email,
      cell: (u) => (
        <Link href={`/users/${u.id}`} className="flex min-w-0 items-center gap-sm">
          <Avatar className="size-8">
            {u.image && <AvatarImage src={u.image} alt="" />}
            <AvatarFallback>{initials(u.name, u.email)}</AvatarFallback>
          </Avatar>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground underline-offset-2 hover:underline">{u.name ?? u.email}</span>
            <span className="block truncate text-xs text-muted-foreground">{u.email}{u.mobile ? ` · ${u.mobile}` : ""}</span>
          </span>
        </Link>
      ),
    },
    { id: "role", header: "Role", cell: (u) => <div className="flex flex-wrap gap-1">{u.roles.map((r) => <Badge key={r.key} tone="neutral">{r.name}</Badge>)}</div> },
    { id: "status", header: "Status", cell: (u) => <Badge tone={statusTone[u.status] ?? "neutral"}>{u.status.toLowerCase()}{u.passwordSetupRequired ? " · setup pending" : ""}</Badge> },
    {
      id: "branch",
      header: "School / Branch",
      cell: (u) => <span className="text-sm text-muted-foreground">{meta?.schoolName ? `${meta.schoolName} / ${u.branchName ?? "—"}` : (u.branchName ?? "—")}</span>,
    },
    { id: "designation", header: "Designation", cell: (u) => <span className="text-sm text-muted-foreground">{u.designation ?? "—"}</span> },
    { id: "updated", header: "Last Updated", align: "right", sortValue: (u) => u.updatedAt, cell: (u) => <span className="text-xs text-muted-foreground">{formatDateTime(u.updatedAt)}</span> },
  ];

  return (
    <div className="flex flex-col gap-md pb-24 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Users className="size-5 text-primary" /> Users &amp; Access</h1>
          <p className="text-xs text-muted-foreground">Manage users, roles and account access.</p>
        </div>
        {(provisionableRoles?.length ?? 0) > 0 && (
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/users/new"><Plus className="size-3.5" /> Create Account</Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or email…" className="pl-8" aria-label="Search users" />
        </div>
        <div className="flex flex-wrap gap-xs">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-36" aria-label="Filter by role"><SelectValue placeholder="Role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {(allRoles ?? []).map((r) => <SelectItem key={r.key} value={r.key}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32" aria-label="Filter by status"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INVITED">Invited</SelectItem>
              <SelectItem value="SUSPENDED">Suspended</SelectItem>
            </SelectContent>
          </Select>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-36" aria-label="Filter by branch"><SelectValue placeholder="Branch" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {(branches ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {isFiltered && <Button size="sm" variant="ghost" onClick={clearFilters}>Clear filters</Button>}
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(u) => u.id}
        caption="Users & Access"
        isFiltered={isFiltered}
        emptyIcon={Users}
        emptyTitle="No users found"
        emptyDescription="Create the first account to get started."
        rowActions={rowActions}
        renderMobileCard={(u) => (
          <div className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-sm">
            <Link href={`/users/${u.id}`} className="flex min-w-0 flex-1 items-center gap-sm">
              <Avatar className="size-9 shrink-0">
                {u.image && <AvatarImage src={u.image} alt="" />}
                <AvatarFallback>{initials(u.name, u.email)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{u.name ?? u.email}</p>
                <p className="truncate text-xs text-muted-foreground">{u.roles.map((r) => r.name).join(", ") || "No role"}</p>
                <p className="truncate text-xs text-muted-foreground">{u.email}{u.mobile ? ` · ${u.mobile}` : ""}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <Badge tone={statusTone[u.status] ?? "neutral"}>{u.status.toLowerCase()}</Badge>
                  {u.branchName && <span className="truncate text-xs text-muted-foreground">{u.branchName}</span>}
                </div>
              </div>
            </Link>
            <RowActionsMenu row={u} actions={rowActions} />
          </div>
        )}
      />

      {(provisionableRoles?.length ?? 0) > 0 && (
        <Button asChild size="md" className="fixed bottom-20 right-md z-40 rounded-pill shadow-floating sm:hidden">
          <Link href="/users/new"><Plus className="size-4" /> Create</Link>
        </Button>
      )}

      <ConfirmDialog
        open={suspendTarget !== null}
        onOpenChange={(o) => !o && setSuspendTarget(null)}
        title="Suspend Account?"
        description={`${suspendTarget?.name ?? suspendTarget?.email ?? "This user"} will no longer be able to use this account to access the system.`}
        confirmLabel="Suspend Account"
        destructive
        onConfirm={doSuspend}
      />
      <ConfirmDialog
        open={reactivateTarget !== null}
        onOpenChange={(o) => !o && setReactivateTarget(null)}
        title="Reactivate Account?"
        description={`${reactivateTarget?.name ?? reactivateTarget?.email ?? "This user"} will be able to access the system again.`}
        confirmLabel="Reactivate"
        onConfirm={doReactivate}
      />
      {passwordTarget && (
        <ChangePasswordDialog
          open={passwordTarget !== null}
          onOpenChange={(o) => !o && setPasswordTarget(null)}
          userId={passwordTarget.id}
          userName={passwordTarget.name ?? passwordTarget.email}
          isSelf={passwordTarget.id === currentUserId}
          onSuccess={reload}
        />
      )}

      <DetailDrawer open={changeRoleTarget !== null} onOpenChange={(o) => !o && setChangeRoleTarget(null)} title="Change role" description="Assign an additional role to this account.">
        {changeRoleTarget && (
          <div className="flex flex-col gap-sm">
            <div>
              <p className="text-xs text-muted-foreground">Current roles</p>
              <div className="mt-1 flex flex-wrap gap-1">{changeRoleTarget.roles.map((r) => <Badge key={r.key} tone="neutral">{r.name}</Badge>)}</div>
            </div>
            <div>
              <Label>Assign a new role</Label>
              <Select value={changeRoleSelection} onValueChange={setChangeRoleSelection}>
                <SelectTrigger aria-label="New role"><SelectValue placeholder="Choose a role" /></SelectTrigger>
                <SelectContent>
                  {(provisionableRoles ?? []).filter((r) => !changeRoleTarget.roles.some((cr) => cr.key === r.key)).map((r) => <SelectItem key={r.key} value={r.key}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">Only roles your account is authorized to grant are listed. This adds the role — it does not remove existing roles.</p>
            </div>
            {assignRole.error && <p className="text-xs text-destructive">{assignRole.error}</p>}
            <Button size="sm" disabled={!changeRoleSelection || assignRole.loading} onClick={doChangeRole}>{assignRole.loading ? "Assigning…" : "Assign role"}</Button>
          </div>
        )}
      </DetailDrawer>

      <DetailDrawer open={activityTarget !== null} onOpenChange={(o) => !o && setActivityTarget(null)} title="Activity" description="Recent account activity.">
        {activityLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (activity ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-sm">
            {(activity ?? []).map((e) => (
              <li key={e.id} className="rounded-md border border-border p-sm">
                <p className="text-sm font-medium text-foreground">{activityLabel(e.action)}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(e.createdAt)}{e.actorName ? ` · by ${e.actorName}` : ""}</p>
              </li>
            ))}
          </ul>
        )}
      </DetailDrawer>
    </div>
  );
}
