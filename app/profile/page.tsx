"use client";

// My Profile — information about the logged-in user, real data only (real
// PostgreSQL/API cutover; GET /api/me/profile). Identity-scoped: every
// authenticated user can view their own profile, no permission required.
//
// Everything shown here is system-controlled (assigned by an administrator),
// not self-editable — there is no existing business rule letting a user
// change their own role, school/branch membership, employee ID, or HR
// profile fields, so this page doesn't fabricate an edit flow for them.
// Password is the one thing a user genuinely controls — that lives in
// Account Settings, not here.
import Link from "next/link";
import { Info, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useMyProfile, initialsFrom } from "@/lib/hooks/api/use-account";
import { roleLabels } from "@/lib/permissions/roles";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value ?? "—"}</p>
    </div>
  );
}

export default function ProfilePage() {
  const { role } = usePermissions();
  const { data: profile, loading, error } = useMyProfile();

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">My Profile</h1>
        <p className="text-xs text-muted-foreground">Information about your account.</p>
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}
      {loading && !profile && <p className="text-xs text-muted-foreground">Loading…</p>}

      {profile && (
        <>
          <div className="surface-3d flex items-center gap-md rounded-lg border border-border bg-surface p-md">
            {profile.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- profile-page-sized avatar, not worth next/image's overhead here
              <img src={profile.image} alt="" className="size-16 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
                {initialsFrom(profile.name, profile.email)}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-foreground">{profile.name ?? "—"}</p>
              <p className="truncate text-sm text-muted-foreground">{profile.designation ?? roleLabels[role]}</p>
              <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
                <Mail className="size-3 shrink-0" /> {profile.email}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-md">
            <div className="mb-sm flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Account details</h2>
            </div>
            <p className="mb-sm text-xs text-muted-foreground">Set by your school administrator — you can&apos;t edit these here.</p>
            <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
              <Field label="Full name" value={profile.name} />
              <Field label="Role" value={roleLabels[role]} />
              <Field label="Email" value={profile.email} />
              <Field label="Mobile number" value={profile.phone} />
              {profile.idValue && <Field label={profile.idLabel ?? "ID"} value={profile.idValue} />}
              {profile.department && <Field label="Department" value={profile.department} />}
              {profile.designation && <Field label="Designation" value={profile.designation} />}
              <Field label="School" value={profile.schoolName} />
              {profile.branchName && <Field label="Branch" value={profile.branchName} />}
            </div>
          </div>

          <div className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <KeyRound className="size-4 shrink-0" />
              Need to change your password or manage sign-in?
            </div>
            <Link href="/account" className="shrink-0 font-medium text-primary hover:underline">
              Account Settings
            </Link>
          </div>

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="size-3 shrink-0" />
            To update your name, contact details, role or department, contact your school administrator.
          </p>
        </>
      )}
    </div>
  );
}
