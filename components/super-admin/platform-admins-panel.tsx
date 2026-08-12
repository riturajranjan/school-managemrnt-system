"use client";

// Real platform-admin management (Super Admin SA-4N). Lists real PlatformAdmin
// rows, invites (honest "Invitation pending" — no email is sent), updates role,
// and activates/suspends with last-super-admin protection enforced server-side.
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import {
  invitePlatformAdminRequest,
  setPlatformAdminStatusRequest,
  updatePlatformAdminRequest,
  usePlatformAdmins,
} from "@/lib/hooks/api/use-platform-system";
import type { StatusTone } from "@/lib/types/common";

const ROLES = ["SUPER_ADMIN", "SUPPORT", "BILLING", "AUDITOR"] as const;
const roleLabel: Record<string, string> = { SUPER_ADMIN: "Super Admin", SUPPORT: "Support", BILLING: "Billing", AUDITOR: "Auditor" };
const statusTone: Record<string, StatusTone> = { active: "success", invited: "info", suspended: "warning", inactive: "neutral", locked: "error" };

export function PlatformAdminsPanel() {
  const { hasServerPermission } = usePermissions();
  const canManage = hasServerPermission("platform.admins.manage");
  const { data, loading, error, reload } = usePlatformAdmins();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("SUPPORT");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function run(id: string, fn: () => Promise<{ success: boolean; error?: { message: string } }>) {
    setBusy(id); setActionError(null);
    const res = await fn();
    setBusy(null);
    if (!res.success) setActionError(res.error?.message ?? "Failed"); else reload();
  }

  async function invite() {
    setBusy("invite"); setActionError(null);
    const res = await invitePlatformAdminRequest({ name: name.trim(), email: email.trim(), role });
    setBusy(null);
    if (!res.success) setActionError(res.error.message);
    else { setName(""); setEmail(""); setOpen(false); reload(); }
  }

  return (
    <section>
      <div className="mb-sm flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Platform admins {data.length > 0 && `(${data.length})`}</h2>
        {canManage && <Button size="sm" onClick={() => setOpen((o) => !o)}>Invite admin</Button>}
      </div>

      {actionError && <p className="mb-sm rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">{actionError}</p>}

      {open && canManage && (
        <div className="mb-sm flex flex-col gap-sm rounded-lg border border-border bg-surface p-md sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1"><span className="text-xs text-muted-foreground">Name</span><Input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="flex flex-1 flex-col gap-1"><span className="text-xs text-muted-foreground">Email</span><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">Role</span>
            <Select value={role} onValueChange={setRole}><SelectTrigger aria-label="Role" className="w-40"><SelectValue /></SelectTrigger><SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{roleLabel[r]}</SelectItem>)}</SelectContent></Select>
          </label>
          <Button size="sm" disabled={busy === "invite" || !name.trim() || !email.trim()} onClick={() => void invite()}>Send invite</Button>
        </div>
      )}
      <p className="mb-sm text-xs text-muted-foreground">Invites create an account in <span className="font-medium">Invitation pending</span> state — no email is sent (delivery integration not configured).</p>

      {loading && <div className="py-lg text-center text-sm text-muted-foreground">Loading admins…</div>}
      {error && !loading && <div className="rounded-lg border border-dashed border-error/40 p-md text-center text-sm text-error">Could not load admins: {error}</div>}

      {!loading && !error && (
        <div className="flex flex-col gap-xs">
          {data.map((a) => (
            <div key={a.id} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0"><p className="truncate font-medium text-foreground">{a.name ?? a.email}</p><p className="truncate text-xs text-muted-foreground">{a.email}</p></div>
              <div className="flex flex-wrap items-center gap-2">
                {a.invitePending && <Badge tone="info">Invitation pending</Badge>}
                <Badge tone={statusTone[a.status] ?? "neutral"}>{a.status}</Badge>
                {canManage ? (
                  <Select value={a.role} onValueChange={(v) => void run(a.id, () => updatePlatformAdminRequest(a.id, { role: v }))}>
                    <SelectTrigger aria-label={`${a.email} role`} className="h-7 w-36 text-xs" disabled={busy === a.id}><SelectValue /></SelectTrigger>
                    <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{roleLabel[r]}</SelectItem>)}</SelectContent>
                  </Select>
                ) : <Badge tone="neutral">{roleLabel[a.role] ?? a.role}</Badge>}
                {canManage && (a.status === "suspended" ? (
                  <Button size="sm" variant="outline" disabled={busy === a.id} onClick={() => void run(a.id, () => setPlatformAdminStatusRequest(a.id, "active"))}>Reactivate</Button>
                ) : (
                  <Button size="sm" variant="ghost" className="text-error" disabled={busy === a.id} onClick={() => void run(a.id, () => setPlatformAdminStatusRequest(a.id, "suspended"))}>Suspend</Button>
                ))}
              </div>
            </div>
          ))}
          {data.length === 0 && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No platform admins.</p>}
        </div>
      )}
    </section>
  );
}
