"use client";

// Phase 9W.2 — real cutover. Was fully mock (useSystemUsers/admin-service,
// legacy UserRole matrix, "no real authentication in this UI phase"). Now:
// real GET /api/users (tenant-scoped), real role assignment/suspend via
// /api/users/[userId]/roles and /status, and a real "Create user" flow over
// POST /api/users/provision — every target role offered comes from
// GET /api/users/provisionable-roles (server policy), never a hardcoded list.
// Same layout/structure as before (no redesign) plus the creation form the
// old mock page never had.
import { useState } from "react";
import { Search, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { apiGet } from "@/lib/api/client";
import { useAccounts, useAssignRole, useProvisionAccount, useProvisionableRoles, useSetAccountStatus } from "@/lib/hooks/api/use-users-api";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDateTime } from "@/lib/utils";

const STAFF_LINKED_ROLES = new Set(["PRINCIPAL", "VICE_PRINCIPAL", "TEACHER", "HR_ADMIN", "TRANSPORT_MANAGER", "LIBRARIAN", "STAFF"]);

type DomainKind = "staff" | "student" | "guardian";
type DomainOption = { id: string; label: string; sub: string };

function domainEndpoint(kind: DomainKind, q: string): string {
  if (kind === "staff") return `/api/staff?search=${encodeURIComponent(q)}&pageSize=6`;
  if (kind === "student") return `/api/students?search=${encodeURIComponent(q)}&pageSize=6`;
  return `/api/guardians?search=${encodeURIComponent(q)}&pageSize=6`;
}

/** Minimal live search over the real staff/student/guardian directories — no mock data, no client-maintained list. */
function DomainPicker({ kind, value, onChange }: { kind: DomainKind; value: DomainOption | null; onChange: (v: DomainOption | null) => void }) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<DomainOption[]>([]);
  const [open, setOpen] = useState(false);

  async function search(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setOptions([]);
      return;
    }
    const res = await apiGet<Record<string, unknown>[]>(domainEndpoint(kind, q));
    if (!res.success) return;
    setOptions(
      res.data.map((row) => {
        if (kind === "staff") return { id: String(row.id), label: String(row.name ?? ""), sub: String(row.employeeCode ?? "") };
        if (kind === "student") return { id: String(row.id), label: String(row.fullName ?? ""), sub: String(row.admissionNumber ?? "") };
        return { id: String(row.id), label: String(row.fullName ?? ""), sub: String(row.email ?? row.phone ?? "") };
      }),
    );
  }

  if (value) {
    return (
      <div className="flex items-center justify-between gap-sm rounded-md border border-border bg-surface px-sm py-1.5 text-sm">
        <span className="truncate">{value.label} {value.sub && <span className="text-muted-foreground">· {value.sub}</span>}</span>
        <Button size="sm" variant="ghost" onClick={() => onChange(null)}>Change</Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => { search(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={`Search ${kind}s by name…`}
      />
      {open && options.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-surface shadow-lg">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              className="block w-full px-sm py-1.5 text-left text-sm hover:bg-muted"
              onClick={() => { onChange(o); setOpen(false); }}
            >
              {o.label} <span className="text-xs text-muted-foreground">{o.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateUserForm({ onDone }: { onDone: () => void }) {
  const { data: provisionableRoles } = useProvisionableRoles();
  const provision = useProvisionAccount();
  const [targetRoleKey, setTargetRoleKey] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [domainValue, setDomainValue] = useState<DomainOption | null>(null);
  const [result, setResult] = useState<{ passwordSetupUrl: string | null; accountCreated: boolean } | null>(null);

  const domainKind: DomainKind | null = targetRoleKey ? (STAFF_LINKED_ROLES.has(targetRoleKey) ? "staff" : targetRoleKey === "STUDENT" ? "student" : targetRoleKey === "GUARDIAN" ? "guardian" : null) : null;

  async function submit() {
    if (!targetRoleKey || !email || !domainKind || !domainValue) return;
    const idField = domainKind === "staff" ? { staffId: domainValue.id } : domainKind === "student" ? { studentId: domainValue.id } : { guardianId: domainValue.id };
    const res = await provision.run({ targetRoleKey, email, name: name || undefined, ...idField });
    if (res.success) {
      setResult({ passwordSetupUrl: res.data.passwordSetupUrl, accountCreated: res.data.accountCreated });
      setTargetRoleKey("");
      setEmail("");
      setName("");
      setDomainValue(null);
      onDone();
    }
  }

  if (result) {
    return (
      <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md text-sm">
        <p className="font-medium text-foreground">{result.accountCreated ? "Account created." : "Account linked."}</p>
        {result.passwordSetupUrl ? (
          <>
            <p className="text-muted-foreground">Password setup is pending — no email was sent. Share this link securely with the new user:</p>
            <code className="break-all rounded bg-muted px-2 py-1 text-xs">{result.passwordSetupUrl}</code>
          </>
        ) : (
          <p className="text-muted-foreground">This email already had an active account — the new role was added to it directly.</p>
        )}
        <Button size="sm" variant="outline" onClick={() => setResult(null)}>Create another</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
      <div>
        <Label>Role</Label>
        <Select value={targetRoleKey} onValueChange={(v) => { setTargetRoleKey(v); setDomainValue(null); }}>
          <SelectTrigger aria-label="Target role"><SelectValue placeholder="Choose a role you may grant" /></SelectTrigger>
          <SelectContent>
            {(provisionableRoles ?? []).map((r) => <SelectItem key={r.key} value={r.key}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {provisionableRoles?.length === 0 && <p className="mt-1 text-xs text-muted-foreground">Your role is not authorized to provision any account type.</p>}
      </div>
      {domainKind && (
        <div>
          <Label>{domainKind === "staff" ? "Staff record" : domainKind === "student" ? "Student" : "Guardian"}</Label>
          <DomainPicker kind={domainKind} value={domainValue} onChange={setDomainValue} />
        </div>
      )}
      <div>
        <Label>Email</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
      </div>
      <div>
        <Label>Display name (optional)</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      {provision.error && <p className="text-xs text-destructive">{provision.error}</p>}
      <Button size="sm" disabled={!targetRoleKey || !email || !domainValue || provision.loading} onClick={submit}>
        {provision.loading ? "Creating…" : "Create user"}
      </Button>
    </div>
  );
}

export default function UsersPage() {
  const { can, role, capabilitiesLoading } = usePermissions();
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const { data: users, reload } = useAccounts({ search: query || undefined });
  const setStatus = useSetAccountStatus();
  const assignRole = useAssignRole();
  const { data: provisionableRoles } = useProvisionableRoles();

  const canManage = can("users.manage");
  const rows = users;
  const assignableKeys = new Set((provisionableRoles ?? []).map((r) => r.key));

  if (!capabilitiesLoading && !canManage) return <PermissionDenied action="view users" role={roleLabels[role]} backHref="/settings" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center justify-between gap-sm">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Users className="size-5 text-primary" /> Users & access</h1>
          <p className="text-xs text-muted-foreground">{rows.length} account{rows.length === 1 ? "" : "s"} · real accounts, real Login API</p>
        </div>
        {canManage && <Button size="sm" onClick={() => setShowCreate((v) => !v)}><UserPlus className="size-3.5" /> Create user</Button>}
      </div>

      {showCreate && <CreateUserForm onDone={reload} />}

      <div className="relative max-w-sm"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search users…" aria-label="Search users" className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary" /></div>

      <div className="flex flex-col gap-xs">
        {rows.map((u) => (
          <div key={u.id} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{(u.name ?? u.email).split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{u.name ?? u.email}</p>
                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-xs">
              {u.roles.map((r) => <Badge key={r.key} tone="neutral">{r.name}</Badge>)}
              <Badge tone={u.status === "SUSPENDED" ? "error" : u.status === "INVITED" ? "warning" : "success"}>{u.status.toLowerCase()}{u.passwordSetupRequired ? " · setup pending" : ""}</Badge>
              {canManage && (
                <>
                  {assignableKeys.size > 0 && (
                    <Select onValueChange={(v) => assignRole.run(u.id, v).then(() => reload())}>
                      <SelectTrigger aria-label="Add role" className="h-7 w-36 text-xs"><SelectValue placeholder="+ Add role" /></SelectTrigger>
                      <SelectContent>
                        {(provisionableRoles ?? []).filter((r) => !u.roles.some((ur) => ur.key === r.key)).map((r) => <SelectItem key={r.key} value={r.key}>{r.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  {u.status === "SUSPENDED" ? (
                    <Button size="sm" variant="outline" onClick={() => setStatus.run(u.id, "ACTIVE").then(() => reload())}>Reactivate</Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setStatus.run(u.id, "SUSPENDED").then(() => reload())}>Suspend</Button>
                  )}
                </>
              )}
              {!canManage && <span className="text-xs text-muted-foreground">{formatDateTime(u.createdAt)}</span>}
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No users match your search.</div>}
      </div>
    </div>
  );
}
