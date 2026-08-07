"use client";

import Link from "next/link";
import { CalendarDays, FileText, GraduationCap, Megaphone, Upload, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { EmployeeAvatar } from "@/components/hr/employee-avatar";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { CURRENT_TEACHER_ID } from "@/lib/current-user";
import { hrAttendanceStatusLabels, hrAttendanceStatusTone, hrLeaveTypeLabels } from "@/lib/types/hr";

export default function EmployeeSelfServicePage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("hr.viewOwn") && !can("hr.view")) return <PermissionDenied action="access employee self service" role={roleLabels[role]} backHref="/" />;

  // No auth yet — resolve the signed-in employee from the demo teacher identity,
  // falling back to the first employee.
  const me = db.employees.find((e) => e.teacherId === CURRENT_TEACHER_ID) ?? db.employees[0];
  if (!me) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No employee profile linked to your account.</div>;

  const today = new Date().toISOString().slice(0, 10);
  const todayAtt = db.hrAttendance.find((a) => a.employeeId === me.id && a.date === today);
  const balances = db.leaveBalances.filter((b) => b.employeeId === me.id);
  const enrollments = db.trainingEnrollments.filter((e) => e.employeeId === me.id);
  const documents = db.staffDocuments.filter((d) => d.employeeId === me.id);
  const assets = db.employeeAssets.filter((a) => a.employeeId === me.id);
  const announcements = db.hrAnnouncements.filter((a) => a.audience === "all-staff" || (a.audience === "teaching" && me.isTeaching));
  const contract = db.contracts.find((c) => c.employeeId === me.id);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <EmployeeAvatar firstName={me.firstName} lastName={me.lastName} color={me.photoColor} size="lg" />
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-foreground">Hi, {me.firstName}</h1>
          <p className="truncate text-xs text-muted-foreground">{db.designations.find((d) => d.id === me.designationId)?.title} · {me.employeeCode}</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-xs">
        <Button asChild size="sm"><Link href="/hr/leave"><CalendarDays className="size-3.5" /> Apply leave</Link></Button>
        <Button asChild size="sm" variant="outline"><Link href="/payroll"><Wallet className="size-3.5" /> Payslips</Link></Button>
        <Button asChild size="sm" variant="outline"><Link href={`/hr/staff/${me.id}`}><FileText className="size-3.5" /> My profile</Link></Button>
        <Button asChild size="sm" variant="ghost"><Link href="/hr/documents"><Upload className="size-3.5" /> Upload document</Link></Button>
        <Button asChild size="sm" variant="ghost"><Link href="/hr/letters"><FileText className="size-3.5" /> Request letter</Link></Button>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Today</p>
          {todayAtt ? <Badge tone={hrAttendanceStatusTone[todayAtt.status]}>{hrAttendanceStatusLabels[todayAtt.status]}</Badge> : <span className="text-sm text-muted-foreground">Not marked</span>}
        </div>
        <StatTile label="Attendance" value={`${me.attendancePercent}%`} tone="neutral" />
        <StatTile label="Leave balance" value={`${me.leaveBalanceDays}d`} tone="info" />
        <StatTile label="Trainings" value={String(enrollments.length)} tone="neutral" />
      </div>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Leave balance</h2>
          <div className="grid grid-cols-2 gap-sm">
            {balances.map((b) => (
              <div key={b.id} className="rounded-md border border-border p-sm">
                <p className="text-xs text-muted-foreground">{hrLeaveTypeLabels[b.leaveType]}</p>
                <p className="text-sm font-semibold text-foreground">{b.entitledDays - b.usedDays} / {b.entitledDays}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground"><Megaphone className="size-4" /> Announcements</h2>
          <div className="flex flex-col gap-xs">
            {announcements.slice(0, 4).map((a) => (
              <div key={a.id} className="rounded-md border border-border p-sm">
                <p className="text-sm font-medium text-foreground">{a.title}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{a.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground"><GraduationCap className="size-4" /> My training</h2>
          {enrollments.length === 0 ? <p className="text-xs text-muted-foreground">No training assigned.</p> : (
            <div className="flex flex-col gap-xs">
              {enrollments.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-sm text-sm">
                  <span className="truncate text-foreground">{db.trainingCourses.find((c) => c.id === e.courseId)?.name}</span>
                  <Badge tone={e.status === "completed" ? "success" : e.status === "overdue" ? "error" : "info"}>{e.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">My records</h2>
          <div className="flex flex-col gap-xs text-sm">
            <Row label="Contract" value={contract ? contract.status : "—"} />
            <Row label="Documents" value={`${documents.filter((d) => d.status === "verified").length}/${documents.length} verified`} />
            <Row label="Assets" value={`${assets.length} assigned`} />
            {me.isTeaching && <Link href="/teacher/my-day" className="text-xs font-medium text-primary">Open my teaching day →</Link>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
