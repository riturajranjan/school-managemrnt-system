"use client";

// Real PostgreSQL/API cutover (Production migration, Phase B) — reads GET
// /api/hr/self-service, identity-scoped to the CALLER's own real Staff
// record (Staff.userId === caller) — never a hardcoded demo identity like
// the old CURRENT_TEACHER_ID. Contracts/documents (Sub-batch 2) are real:
// compensationNote is always redacted here regardless of role (self-service
// never implies hr.view/hr.manage), and documents are pre-filtered server-
// side to visibility=staff-visible only. Performance/training (Sub-batch 3)
// are the same pattern: only COMPLETED + explicitly visibleToEmployee
// reviews, and read-only training assignments — no create/assign/complete
// path exists for hr.viewOwn. Announcement sections are added here as their
// real models land in later Phase B sub-batches — shown honestly as "not
// available yet" until then, never backed by mock data.
import Link from "next/link";
import { CalendarDays, MessageSquareText, User, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useHrSelfService } from "@/lib/hooks/api/use-staff-api";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDate } from "@/lib/utils";

const leaveStatusTone: Record<string, "success" | "warning" | "error" | "neutral"> = { approved: "success", pending: "warning", rejected: "error", cancelled: "neutral" };
const attendanceTone: Record<string, "success" | "warning" | "error" | "info" | "neutral"> = {
  present: "success", late: "warning", absent: "error", "half-day": "warning", "on-leave": "info",
};
const contractStatusTone: Record<string, "success" | "warning" | "error" | "neutral" | "info"> = {
  draft: "neutral", active: "success", "renewal-pending": "warning", expired: "error", terminated: "neutral", archived: "neutral",
};
const documentStatusTone: Record<string, "success" | "warning" | "error" | "neutral" | "info"> = {
  uploaded: "info", verified: "success", rejected: "error", archived: "neutral",
};
const trainingStatusTone: Record<string, "success" | "warning" | "error" | "neutral" | "info"> = {
  assigned: "info", "in-progress": "warning", completed: "success", cancelled: "neutral",
};

export default function EmployeeSelfServicePage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data, loading, error } = useHrSelfService();
  if (!capabilitiesLoading && !hasServerPermission("hr.viewOwn") && !hasServerPermission("hr.view") && !hasServerPermission("hr.manage")) {
    return <PermissionDenied action="access employee self service" role={roleLabels[role]} backHref="/" />;
  }

  if (loading && !data) return <p className="text-xs text-muted-foreground">Loading…</p>;
  if (error) {
    return (
      <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
        <p className="text-sm font-medium text-foreground">No employee profile linked to your account</p>
        <p className="text-xs text-muted-foreground">Ask your administrator to link your login to your Staff record.</p>
      </div>
    );
  }
  if (!data) return null;

  const { staff, todayAttendance, attendancePercent, recentLeaveRequests, contracts, documents, performanceReviews, trainingAssignments } = data;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">{staff.name.slice(0, 2).toUpperCase()}</span>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-foreground">Hi, {staff.firstName}</h1>
          <p className="truncate text-xs text-muted-foreground">{staff.designation ?? "—"} · {staff.employeeCode}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-xs">
        <Button asChild size="sm"><Link href="/attendance/leave"><CalendarDays className="size-3.5" /> Apply leave</Link></Button>
        <Button asChild size="sm" variant="outline"><Link href="/payroll"><Wallet className="size-3.5" /> Payslips</Link></Button>
        <Button asChild size="sm" variant="outline"><Link href="/profile"><User className="size-3.5" /> My profile</Link></Button>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Today</p>
          {todayAttendance ? <Badge tone={attendanceTone[todayAttendance.status] ?? "neutral"}>{todayAttendance.status.replace("-", " ")}</Badge> : <span className="text-sm text-muted-foreground">Not marked</span>}
        </div>
        <StatTile label="Attendance (this month)" value={attendancePercent.percentage !== null ? `${attendancePercent.percentage}%` : "—"} tone="neutral" />
        <StatTile label="Leave requests" value={String(recentLeaveRequests.length)} tone="info" />
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Recent leave requests</h2>
        {recentLeaveRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No leave requests yet.</p>
        ) : (
          <div className="flex flex-col gap-xs">
            {recentLeaveRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm">
                <div className="min-w-0">
                  <p className="truncate text-foreground">{r.leaveTypeName} · {formatDate(r.startDate)} – {formatDate(r.endDate)}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.reason}</p>
                </div>
                <Badge tone={leaveStatusTone[r.status] ?? "neutral"}>{r.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">My contract</h2>
        {contracts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No contracts found.</p>
        ) : (
          <div className="flex flex-col gap-xs">
            {contracts.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm">
                <div className="min-w-0">
                  <p className="truncate text-foreground">{formatDate(c.startDate)} – {c.endDate ? formatDate(c.endDate) : "no end date"}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.terms ?? "No additional terms on file"}</p>
                </div>
                <Badge tone={contractStatusTone[c.status] ?? "neutral"}>{c.status.replace("-", " ")}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">My documents</h2>
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents found.</p>
        ) : (
          <div className="flex flex-col gap-xs">
            {documents.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm">
                <div className="min-w-0">
                  <p className="truncate text-foreground">{d.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{d.expiryDate ? `Expires ${formatDate(d.expiryDate)}` : "No expiry"}</p>
                </div>
                <Badge tone={documentStatusTone[d.status] ?? "neutral"}>{d.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">My performance reviews</h2>
        {performanceReviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No performance reviews found.</p>
        ) : (
          <div className="flex flex-col gap-xs">
            {performanceReviews.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm">
                <div className="min-w-0">
                  <p className="truncate text-foreground">{formatDate(r.reviewPeriodStart)} – {formatDate(r.reviewPeriodEnd)}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.summary ?? "No summary on file"}</p>
                </div>
                {r.overallRating !== null && <Badge tone="info">{r.overallRating}/5</Badge>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">My training</h2>
        {trainingAssignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No training programs found.</p>
        ) : (
          <div className="flex flex-col gap-xs">
            {trainingAssignments.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm">
                <div className="min-w-0">
                  <p className="truncate text-foreground">{t.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{formatDate(t.startDate)}{t.endDate ? ` – ${formatDate(t.endDate)}` : ""}{t.certificateIssued ? " · Certificate issued" : ""}</p>
                </div>
                <Badge tone={trainingStatusTone[t.status] ?? "neutral"}>{t.status.replace("-", " ")}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-dashed border-border bg-surface p-md text-center">
        <MessageSquareText className="mx-auto mb-1 size-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Announcements will appear here as that module goes live.</p>
      </div>
    </div>
  );
}
