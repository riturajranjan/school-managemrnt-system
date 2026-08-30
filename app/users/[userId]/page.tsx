"use client";

// View Profile / Edit Account (User List UX pass). Real GET/PATCH
// /api/users/[userId] — see lib/server/users/account-detail.ts for exactly
// which fields are real and editable per account kind (Staff/Student/
// Guardian) and why. Never renders passwordHash, a raw setup token, or a
// session token — the API itself never returns them.
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  Ban,
  History,
  KeyRound,
  Pencil,
  RotateCcw,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { ChangePasswordDialog } from "@/components/users/change-password-dialog";
import { useApiResource } from "@/lib/hooks/api/use-api";
import {
  useAccountActivity,
  useAccountDetail,
  useAssignRole,
  useProvisionableRoles,
  useSetAccountStatus,
  useUpdateAccount,
  type EditAccountInput,
} from "@/lib/hooks/api/use-users-api";
import { useDesignations } from "@/lib/hooks/api/use-hr-api";
import { formatDate, formatDateTime } from "@/lib/utils";

const ACTIVITY_LABELS: Record<string, string> = {
  USER_ACCOUNT_PROVISIONED: "Account created",
  USER_ACCOUNT_LINKED: "Account linked",
  USER_ROLE_ASSIGNED: "Role assigned",
  USER_ACCOUNT_SUSPENDED: "Account suspended",
  USER_ACCOUNT_ACTIVATED: "Account reactivated",
  PASSWORD_RESET: "Password reset",
  PASSWORD_CHANGED: "Password changed",
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
  return src
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-medium text-foreground">
        {value ?? "—"}
      </dd>
    </div>
  );
}

export default function UserProfilePage() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: detail, loading, error, reload } = useAccountDetail(userId);
  const update = useUpdateAccount();
  const [editing, setEditing] = useState(searchParams.get("edit") === "1");
  const [form, setForm] = useState<EditAccountInput>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const { data: designations } = useDesignations({ status: "active" });

  const { can } = usePermissions();
  const canManage = can("users.manage");
  const { data: currentContext } = useApiResource<{ user: { id: string } }>("/api/auth/context");
  const currentUserId = currentContext?.user.id ?? null;
  const isSelf = userId === currentUserId;
  const { data: provisionableRoles } = useProvisionableRoles();
  const assignRole = useAssignRole();
  const setStatus = useSetAccountStatus();
  const { data: activity, loading: activityLoading } = useAccountActivity(userId);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [changeRoleOpen, setChangeRoleOpen] = useState(false);
  const [changeRoleSelection, setChangeRoleSelection] = useState("");
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);

  async function doChangeRole() {
    if (!changeRoleSelection) return;
    const res = await assignRole.run(userId, changeRoleSelection);
    if (res.success) {
      setChangeRoleOpen(false);
      setChangeRoleSelection("");
      reload();
    }
  }
  async function doSuspend() {
    const res = await setStatus.run(userId, "SUSPENDED");
    if (res.success) reload();
  }
  async function doReactivate() {
    const res = await setStatus.run(userId, "ACTIVE");
    if (res.success) reload();
  }

  // Seed the edit form from the freshly-loaded detail — a render-phase state
  // adjustment (React's documented pattern for "state that depends on a prop/
  // fetch result"), not a useEffect, so it never causes an extra commit.
  if (detail && seededFor !== detail.id) {
    setSeededFor(detail.id);
    setForm({
      firstName: detail.personal.firstName ?? undefined,
      lastName: detail.personal.lastName ?? undefined,
      gender:
        (detail.personal.gender as EditAccountInput["gender"]) ?? undefined,
      dateOfBirth: detail.personal.dateOfBirth ?? undefined,
      phone: detail.personal.mobile ?? undefined,
      email: detail.personal.contactEmail ?? undefined,
      photoUrl: detail.personal.photoUrl ?? undefined,
      designationId: undefined,
      joiningDate: detail.schoolAssignment?.joiningDate ?? undefined,
    });
  }

  if (loading)
    return <p className="p-md text-sm text-muted-foreground">Loading…</p>;
  if (error || !detail) {
    return (
      <div className="mx-auto flex  flex-col items-center gap-sm py-3xl text-center">
        <p className="text-sm font-medium text-foreground">Account not found</p>
        <p className="text-xs text-muted-foreground">
          {error ?? "This account could not be loaded."}
        </p>
        <Button asChild size="sm" variant="outline">
          <Link href="/users">
            <ArrowLeft className="size-3.5" /> Back to Users &amp; Access
          </Link>
        </Button>
      </div>
    );
  }

  async function save() {
    setSaveError(null);
    // Only send fields that are actually editable for this account kind —
    // the server rejects anything else, but there's no reason to send it.
    const allowed: Record<
      Exclude<NonNullable<typeof detail>["domainKind"], null>,
      (keyof EditAccountInput)[]
    > = {
      staff: [
        "firstName",
        "lastName",
        "phone",
        "email",
        "designationId",
        "joiningDate",
      ],
      student: [
        "firstName",
        "lastName",
        "gender",
        "dateOfBirth",
        "phone",
        "email",
        "photoUrl",
      ],
      guardian: ["firstName", "lastName", "phone", "email", "photoUrl"],
    };
    const kind = detail!.domainKind;
    if (!kind) return;
    const payload: EditAccountInput = {};
    for (const key of allowed[kind]) {
      const v = form[key];
      if (v !== undefined && v !== "")
        (payload as Record<string, unknown>)[key] = v;
    }
    const res = await update.run(userId, payload);
    if (res.success) {
      setSaved(true);
      setEditing(false);
      reload();
      setTimeout(() => setSaved(false), 4000);
    } else {
      setSaveError(res.error.message);
    }
  }

  const kind = detail.domainKind;

  return (
    <div className="mx-auto flex  flex-col gap-md pb-20 sm:pb-0">
      <div>
        <Link
          href="/users"
          className="mb-sm inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Users &amp; Access
        </Link>
        <div className="flex items-center justify-between gap-sm">
          <div className="flex items-center gap-sm">
            <Avatar className="size-12">
              {detail.image && <AvatarImage src={detail.image} alt="" />}
              <AvatarFallback>
                {initials(detail.name, detail.email)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                {detail.name ??
                  ([detail.personal.firstName, detail.personal.lastName]
                    .filter(Boolean)
                    .join(" ") ||
                    detail.email)}
              </h1>
              <p className="text-xs text-muted-foreground">{detail.email}</p>
            </div>
          </div>
        </div>
        {!editing && canManage && (
          <div className="mt-sm flex flex-wrap gap-xs">
            {kind && (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="size-3.5" /> Edit account
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setPasswordOpen(true)}>
              <KeyRound className="size-3.5" /> Change password
            </Button>
            {(provisionableRoles?.length ?? 0) > 0 && !isSelf && (
              <Button size="sm" variant="outline" onClick={() => { setChangeRoleSelection(""); setChangeRoleOpen(true); }}>
                <ShieldCheck className="size-3.5" /> Change role
              </Button>
            )}
            {!isSelf && (detail.status === "SUSPENDED" ? (
              <Button size="sm" variant="outline" onClick={() => setReactivateOpen(true)}>
                <RotateCcw className="size-3.5" /> Reactivate
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setSuspendOpen(true)}>
                <Ban className="size-3.5" /> Suspend
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setActivityOpen(true)}>
              <History className="size-3.5" /> Activity
            </Button>
          </div>
        )}
        {saved && (
          <p className="mt-sm text-xs text-success">Account updated.</p>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
          <p className="text-sm font-medium text-foreground">Edit account</p>
          <div className="grid grid-cols-2 gap-sm">
            <div>
              <Label htmlFor="e-first">First name</Label>
              <Input
                id="e-first"
                value={form.firstName ?? ""}
                onChange={(e) =>
                  setForm({ ...form, firstName: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="e-last">Last name</Label>
              <Input
                id="e-last"
                value={form.lastName ?? ""}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </div>
          </div>
          {kind === "student" && (
            <div className="grid grid-cols-2 gap-sm">
              <div>
                <Label htmlFor="e-dob">Date of birth</Label>
                <Input
                  id="e-dob"
                  type="date"
                  value={form.dateOfBirth ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, dateOfBirth: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Gender</Label>
                <Select
                  value={form.gender ?? "prefer-not-to-say"}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      gender: v as EditAccountInput["gender"],
                    })
                  }>
                  <SelectTrigger aria-label="Gender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="prefer-not-to-say">
                      Prefer not to say
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-sm">
            <div>
              <Label htmlFor="e-mobile">Mobile</Label>
              <Input
                id="e-mobile"
                value={form.phone ?? ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="e-email">Contact email</Label>
              <Input
                id="e-email"
                type="email"
                value={form.email ?? ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>
          {(kind === "student" || kind === "guardian") && (
            <div>
              <Label htmlFor="e-photo">Profile photo URL</Label>
              <Input
                id="e-photo"
                value={form.photoUrl ?? ""}
                onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
              />
            </div>
          )}
          {kind === "staff" && (
            <div className="grid grid-cols-2 gap-sm">
              <div>
                <Label>Designation</Label>
                <Select
                  value={form.designationId ?? ""}
                  onValueChange={(v) => setForm({ ...form, designationId: v })}>
                  <SelectTrigger aria-label="Designation">
                    <SelectValue
                      placeholder={
                        detail.schoolAssignment?.designation ??
                        "Select designation"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {designations.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="e-joining">Joining date</Label>
                <Input
                  id="e-joining"
                  type="date"
                  value={form.joiningDate ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, joiningDate: e.target.value })
                  }
                />
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Branch and login email are not editable here — this codebase has no
            branch-reassignment capability, and changing a login email would
            need a re-verification flow that does not exist yet.
          </p>
          {saveError && <p className="text-xs text-destructive">{saveError}</p>}
          <div className="flex gap-xs">
            <Button size="sm" disabled={update.loading} onClick={save}>
              {update.loading ? "Saving…" : "Save changes"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                router.replace(`/users/${userId}`);
              }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
            <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <UserIcon className="size-4 text-primary" /> Personal information
            </p>
            <dl className="grid grid-cols-2 gap-sm sm:grid-cols-3">
              <Field
                label="Full name"
                value={
                  [detail.personal.firstName, detail.personal.lastName]
                    .filter(Boolean)
                    .join(" ") || null
                }
              />
              {kind === "student" && (
                <Field label="Gender" value={detail.personal.gender} />
              )}
              {kind === "student" && (
                <Field
                  label="Date of birth"
                  value={
                    detail.personal.dateOfBirth
                      ? formatDate(detail.personal.dateOfBirth)
                      : null
                  }
                />
              )}
              <Field label="Mobile" value={detail.personal.mobile} />
              <Field
                label="Contact email"
                value={detail.personal.contactEmail}
              />
              <Field label="Login email" value={detail.email} />
            </dl>
          </section>

          {detail.schoolAssignment && (
            <section className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
              <p className="text-sm font-medium text-foreground">
                School assignment
              </p>
              <dl className="grid grid-cols-2 gap-sm sm:grid-cols-3">
                <Field
                  label="School"
                  value={detail.schoolAssignment.schoolName}
                />
                <Field
                  label="Branch"
                  value={detail.schoolAssignment.branchName}
                />
                {kind === "staff" && (
                  <Field
                    label="Designation"
                    value={detail.schoolAssignment.designation}
                  />
                )}
                {kind === "staff" && (
                  <Field
                    label="Department"
                    value={detail.schoolAssignment.department}
                  />
                )}
                {kind === "staff" && (
                  <Field
                    label="Joining date"
                    value={
                      detail.schoolAssignment.joiningDate
                        ? formatDate(detail.schoolAssignment.joiningDate)
                        : null
                    }
                  />
                )}
              </dl>
            </section>
          )}

          <section className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
            <p className="text-sm font-medium text-foreground">Account</p>
            <dl className="grid grid-cols-2 gap-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Role</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {detail.roles.map((r) => (
                    <Badge key={r.key} tone="neutral">
                      {r.name}
                    </Badge>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Status</dt>
                <dd className="mt-1">
                  <Badge
                    tone={
                      detail.status === "SUSPENDED"
                        ? "error"
                        : detail.status === "INVITED"
                          ? "warning"
                          : "success"
                    }>
                    {detail.status.toLowerCase()}
                  </Badge>
                </dd>
              </div>
              <Field
                label="Email verification"
                value={
                  detail.emailVerifiedAt
                    ? `Verified ${formatDate(detail.emailVerifiedAt)}`
                    : "Not verified"
                }
              />
              <Field
                label="Password setup"
                value={
                  detail.hasPassword
                    ? detail.passwordSetupRequired
                      ? "Reset pending"
                      : "Complete"
                    : "Pending — invite not yet accepted"
                }
              />
              <Field label="Created" value={formatDateTime(detail.createdAt)} />
              <Field
                label="Last updated"
                value={formatDateTime(detail.updatedAt)}
              />
            </dl>
          </section>

          <section className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
            <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <ShieldCheck className="size-4 text-primary" /> Access
            </p>
            <dl className="grid grid-cols-2 gap-sm sm:grid-cols-3">
              <Field
                label="School scope"
                value={detail.schoolAssignment?.schoolName ?? "—"}
              />
              <Field
                label="Branch scope"
                value={detail.schoolAssignment?.branchName ?? "—"}
              />
              <div>
                <dt className="text-xs text-muted-foreground">
                  Effective permissions
                </dt>
                <dd className="text-sm font-medium text-foreground">
                  {detail.access.effectivePermissions.length}
                </dd>
              </div>
            </dl>
            <div className="flex flex-col gap-xs">
              {detail.access.rolePermissions.map((rp) => (
                <details
                  key={rp.roleKey}
                  className="rounded-md border border-border p-sm">
                  <summary className="cursor-pointer text-xs font-medium text-foreground">
                    {rp.roleName}{" "}
                    <span className="text-muted-foreground">
                      · {rp.permissions.length} permissions
                    </span>
                  </summary>
                  <div className="mt-sm flex flex-wrap gap-1">
                    {rp.permissions.map((p) => (
                      <code
                        key={p}
                        className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {p}
                      </code>
                    ))}
                  </div>
                </details>
              ))}
              {detail.access.rolePermissions.length === 0 && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <KeyRound className="size-3.5" /> No roles assigned.
                </p>
              )}
            </div>
          </section>

          <section className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <History className="size-4 text-primary" /> Recent activity
              </p>
              {(activity?.length ?? 0) > 3 && (
                <Button size="sm" variant="ghost" onClick={() => setActivityOpen(true)}>View all</Button>
              )}
            </div>
            {activityLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : (activity ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <ul className="flex flex-col gap-xs">
                {(activity ?? []).slice(0, 3).map((e) => (
                  <li key={e.id} className="text-xs">
                    <span className="font-medium text-foreground">{activityLabel(e.action)}</span>
                    <span className="text-muted-foreground"> · {formatDateTime(e.createdAt)}{e.actorName ? ` · by ${e.actorName}` : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {canManage && (
        <>
          <ChangePasswordDialog
            open={passwordOpen}
            onOpenChange={setPasswordOpen}
            userId={userId}
            userName={detail.name ?? detail.email}
            isSelf={isSelf}
            onSuccess={reload}
          />
          <ConfirmDialog
            open={suspendOpen}
            onOpenChange={setSuspendOpen}
            title="Suspend Account?"
            description={`${detail.name ?? detail.email} will no longer be able to use this account to access the system.`}
            confirmLabel="Suspend Account"
            destructive
            onConfirm={doSuspend}
          />
          <ConfirmDialog
            open={reactivateOpen}
            onOpenChange={setReactivateOpen}
            title="Reactivate Account?"
            description={`${detail.name ?? detail.email} will be able to access the system again.`}
            confirmLabel="Reactivate"
            onConfirm={doReactivate}
          />
          <DetailDrawer open={changeRoleOpen} onOpenChange={setChangeRoleOpen} title="Change role" description="Assign an additional role to this account.">
            <div className="flex flex-col gap-sm">
              <div>
                <p className="text-xs text-muted-foreground">Current roles</p>
                <div className="mt-1 flex flex-wrap gap-1">{detail.roles.map((r) => <Badge key={r.key} tone="neutral">{r.name}</Badge>)}</div>
              </div>
              <div>
                <Label>Assign a new role</Label>
                <Select value={changeRoleSelection} onValueChange={setChangeRoleSelection}>
                  <SelectTrigger aria-label="New role"><SelectValue placeholder="Choose a role" /></SelectTrigger>
                  <SelectContent>
                    {(provisionableRoles ?? []).filter((r) => !detail.roles.some((cr) => cr.key === r.key)).map((r) => <SelectItem key={r.key} value={r.key}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">Only roles your account is authorized to grant are listed. This adds the role — it does not remove existing roles.</p>
              </div>
              {assignRole.error && <p className="text-xs text-destructive">{assignRole.error}</p>}
              <Button size="sm" disabled={!changeRoleSelection || assignRole.loading} onClick={doChangeRole}>{assignRole.loading ? "Assigning…" : "Assign role"}</Button>
            </div>
          </DetailDrawer>
          <DetailDrawer open={activityOpen} onOpenChange={setActivityOpen} title="Activity" description="Full account activity.">
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
        </>
      )}
    </div>
  );
}
