"use client";

// Platform school inspector (Super Admin SA-2) — real, platform-safe metadata
// from GET /api/super-admin/schools/[id]. Shows identity / tenant / branches /
// current session / admin only. Revenue, usage, subscription and billing are NOT
// fabricated here — they arrive with the Revenue phase. Opening this page is
// platform inspection; it does NOT grant the platform admin tenant permissions.
import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { usePermissions } from "@/components/providers/permissions-provider";
import { setSchoolStatusRequest, useSchoolDetail } from "@/lib/hooks/api/use-platform-schools";
import type { StatusTone } from "@/lib/types/common";

const statusLabels: Record<string, string> = {
  "setup-pending": "Setup pending",
  active: "Active",
  suspended: "Suspended",
  inactive: "Inactive",
  archived: "Archived",
};
const statusTone: Record<string, StatusTone> = {
  "setup-pending": "warning",
  active: "success",
  suspended: "error",
  inactive: "neutral",
  archived: "neutral",
};

export default function SchoolDetailPage({ params }: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = use(params);
  const { can } = usePermissions();
  const { data, loading, error, reload } = useSchoolDetail(schoolId);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading) return <div className="py-2xl text-center text-sm text-muted-foreground">Loading school…</div>;
  if (error || !data) {
    return (
      <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">
        {error ? `Could not load school: ${error}` : "School not found."}{" "}
        <Link href="/super-admin/schools" className="text-primary">
          Back
        </Link>
      </div>
    );
  }

  const { school, tenant, branches, currentSession, admins } = data;

  async function setStatus(status: "active" | "suspended") {
    setBusy(true);
    setActionError(null);
    const res = await setSchoolStatusRequest(schoolId, status);
    setBusy(false);
    if (!res.success) setActionError(res.error.message);
    else reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost">
          <Link href="/super-admin/schools">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-lg font-semibold text-foreground">{school.name}</h1>
            <Badge tone={statusTone[school.status] ?? "neutral"}>{statusLabels[school.status] ?? school.status}</Badge>
            {school.setupPending && <Badge tone="warning">Onboarding pending</Badge>}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {school.code} · Tenant {tenant.name} ({tenant.slug})
          </p>
        </div>
        <div className="flex gap-xs">
          {school.setupPending ? (
            <Button asChild size="sm">
              <Link href={`/super-admin/onboarding/${school.id}`}>Continue setup</Link>
            </Button>
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link href={`/super-admin/onboarding/${school.id}`}>Setup complete</Link>
            </Button>
          )}
          {can("platform.schools.suspend") &&
            (school.status === "suspended" ? (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void setStatus("active")}>
                Reactivate
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="text-error" disabled={busy} onClick={() => void setStatus("suspended")}>
                Suspend
              </Button>
            ))}
          </div>
      </div>

      {actionError && <p className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">{actionError}</p>}

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Branches" value={String(branches.length)} tone="neutral" />
        <StatTile label="Current session" value={currentSession?.name ?? "—"} tone={currentSession ? "info" : "neutral"} />
        <StatTile label="Admins" value={String(admins.length)} tone="neutral" />
        <StatTile label="Status" value={statusLabels[school.status] ?? school.status} tone={statusTone[school.status] === "success" ? "success" : "warning"} />
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Identity</h2>
          <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Code</dt>
            <dd className="text-foreground">{school.code}</dd>
            <dt className="text-muted-foreground">Type</dt>
            <dd className="text-foreground">{school.schoolType ?? "—"}</dd>
            <dt className="text-muted-foreground">Board</dt>
            <dd className="text-foreground">{school.board ?? "—"}</dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="text-foreground">{school.email ?? "—"}</dd>
            <dt className="text-muted-foreground">Phone</dt>
            <dd className="text-foreground">{school.phone ?? "—"}</dd>
            <dt className="text-muted-foreground">Timezone</dt>
            <dd className="text-foreground">{school.timezone}</dd>
            <dt className="text-muted-foreground">Created</dt>
            <dd className="text-foreground">{new Date(school.createdAt).toLocaleDateString("en-IN")}</dd>
          </dl>
        </section>

        <section className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Current academic session</h2>
          {currentSession ? (
            <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="text-foreground">{currentSession.name}</dd>
              <dt className="text-muted-foreground">Code</dt>
              <dd className="text-foreground">{currentSession.code}</dd>
              <dt className="text-muted-foreground">Starts</dt>
              <dd className="text-foreground">{currentSession.startDate}</dd>
              <dt className="text-muted-foreground">Ends</dt>
              <dd className="text-foreground">{currentSession.endDate}</dd>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No current session.</p>
          )}
        </section>

        <section className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Branches</h2>
          <ul className="flex flex-col gap-sm">
            {branches.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-sm text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {b.name}
                    {b.isPrimary && <Badge tone="info" className="ml-xs">Primary</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {b.code}
                    {b.city ? ` · ${b.city}` : ""}
                  </p>
                </div>
                <Badge tone={b.status === "active" ? "success" : "neutral"}>{b.status}</Badge>
              </li>
            ))}
            {branches.length === 0 && <p className="text-sm text-muted-foreground">No branches.</p>}
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">School admins</h2>
          <ul className="flex flex-col gap-sm">
            {admins.map((a) => (
              <li key={a.userId} className="flex items-center justify-between gap-sm text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{a.name ?? a.email}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.email}</p>
                </div>
                {a.invitePending ? <Badge tone="warning">Invitation pending</Badge> : <Badge tone="success">{a.status}</Badge>}
              </li>
            ))}
            {admins.length === 0 && <p className="text-sm text-muted-foreground">No admins linked.</p>}
          </ul>
        </section>
      </div>

      <section className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">
        Subscription, usage, billing and health for this school arrive with the Revenue phase — not shown here to avoid fabricating data.
      </section>
    </div>
  );
}
