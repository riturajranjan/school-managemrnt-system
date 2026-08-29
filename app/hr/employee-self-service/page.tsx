"use client";

// Real PostgreSQL/API cutover (Production migration, Phase B) — reads GET
// /api/hr/self-service, identity-scoped to the CALLER's own real Staff
// record (Staff.userId === caller) — never a hardcoded demo identity like
// the old CURRENT_TEACHER_ID. Contract/document/training/announcement
// sections are added here as their real models land in later Phase B
// sub-batches — shown honestly as "not available yet" until then, never
// backed by mock data in the meantime.
import Link from "next/link";
import { CalendarDays, FileText, User, Wallet } from "lucide-react";
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

  const { staff, todayAttendance, attendancePercent, recentLeaveRequests } = data;

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

      <div className="rounded-lg border border-dashed border-border bg-surface p-md text-center">
        <FileText className="mx-auto mb-1 size-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Contracts, documents and training will appear here as those modules go live.</p>
      </div>
    </div>
  );
}
