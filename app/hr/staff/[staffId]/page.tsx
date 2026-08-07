"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, CalendarDays, FileText, GraduationCap, LogOut, Pencil, StickyNote, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmployeeAvatar } from "@/components/hr/employee-avatar";
import { EmployeeJourney } from "@/components/hr/employee-journey";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { addTimelineNote } from "@/lib/services/hr-service";
import { roleLabels } from "@/lib/permissions/roles";
import {
  contractStatusLabels,
  employeeStatusLabels,
  employeeStatusTone,
  employmentTypeLabels,
  enrollmentStatusTone,
  goalStatusTone,
  hrAttendanceStatusLabels,
  hrAttendanceStatusTone,
  hrLeaveStatusTone,
  hrLeaveTypeLabels,
  reviewStageLabels,
  staffDocumentStatusTone,
  staffDocumentTypeLabels,
} from "@/lib/types/hr";
import { formatMoney } from "@/lib/finance/money";
import { formatDate } from "@/lib/utils";

export default function Staff360Page({ params }: { params: Promise<{ staffId: string }> }) {
  const { staffId } = use(params);
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [note, setNote] = useState("");
  const [, force] = useState(0);

  const employee = db.employees.find((e) => e.id === staffId);
  if (!can("hr.view")) return <PermissionDenied action="view employee profiles" role={roleLabels[role]} backHref="/hr" />;
  if (!employee) {
    return (
      <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
        <p className="text-sm font-medium text-foreground">Employee not found</p>
        <Button asChild size="sm" variant="outline"><Link href="/hr/staff">Back to directory</Link></Button>
      </div>
    );
  }

  const canSensitive = can("hr.viewSensitive");
  const dept = db.departments.find((d) => d.id === employee.departmentId);
  const desig = db.designations.find((d) => d.id === employee.designationId);
  const manager = db.employees.find((e) => e.id === employee.reportingManagerId);
  const contract = db.contracts.find((c) => c.employeeId === employee.id);
  const attendance = db.hrAttendance.filter((a) => a.employeeId === employee.id).sort((a, b) => b.date.localeCompare(a.date));
  const todayAtt = attendance.find((a) => a.date === new Date().toISOString().slice(0, 10));
  const leaves = db.hrLeaveRequests.filter((r) => r.employeeId === employee.id);
  const balances = db.leaveBalances.filter((b) => b.employeeId === employee.id);
  const reviews = db.performanceReviews.filter((r) => r.employeeId === employee.id);
  const goals = db.performanceGoals.filter((g) => g.employeeId === employee.id);
  const enrollments = db.trainingEnrollments.filter((e) => e.employeeId === employee.id);
  const documents = db.staffDocuments.filter((d) => d.employeeId === employee.id);
  const assets = db.employeeAssets.filter((a) => a.employeeId === employee.id);
  const timeline = db.employeeTimeline.filter((t) => t.employeeId === employee.id).sort((a, b) => b.date.localeCompare(a.date));
  const courseName = (id: string) => db.trainingCourses.find((c) => c.id === id)?.name ?? id;

  function submitNote() {
    if (!note.trim()) return;
    addTimelineNote(employee!.id, note.trim());
    setNote("");
    force((n) => n + 1);
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back"><Link href="/hr/staff"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-foreground">{employee.firstName} {employee.lastName}</h1>
          <p className="truncate text-xs text-muted-foreground">{employee.employeeCode} · {desig?.title} · {dept?.name}</p>
        </div>
      </div>

      {/* Header card */}
      <div className="flex flex-col gap-md rounded-lg border border-border bg-surface p-md sm:flex-row sm:items-start">
        <EmployeeAvatar firstName={employee.firstName} lastName={employee.lastName} color={employee.photoColor} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-sm">
          <div className="flex flex-wrap items-center gap-xs">
            <Badge tone={employeeStatusTone[employee.status]}>{employeeStatusLabels[employee.status]}</Badge>
            <Badge tone="neutral">{employmentTypeLabels[employee.employmentType]}</Badge>
            {employee.isTeaching && <Badge tone="info">Teaching</Badge>}
          </div>
          <div className="grid grid-cols-2 gap-sm text-sm sm:grid-cols-4">
            <Field label="Joined" value={formatDate(employee.joiningDate)} />
            <Field label="Manager" value={manager ? `${manager.firstName} ${manager.lastName}` : "—"} />
            <Field label="Attendance" value={`${employee.attendancePercent}%`} />
            <Field label="Leave balance" value={`${employee.leaveBalanceDays} days`} />
            <Field label="Email" value={employee.email} />
            <Field label="Phone" value={employee.phone} />
            <Field label="Branch" value={employee.branch} />
            {canSensitive && <Field label="Gross salary" value={formatMoney(employee.grossSalary)} />}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      {can("hr.manageStaff") && (
        <div className="flex flex-wrap gap-xs">
          <Button asChild size="sm" variant="outline"><Link href={`/hr/staff/${employee.id}/edit`}><Pencil className="size-3.5" /> Edit</Link></Button>
          <Button asChild size="sm" variant="ghost"><Link href="/hr/leave"><CalendarDays className="size-3.5" /> Apply leave</Link></Button>
          <Button asChild size="sm" variant="ghost"><Link href="/hr/appraisals"><GraduationCap className="size-3.5" /> Start appraisal</Link></Button>
          {canSensitive && <Button asChild size="sm" variant="ghost"><Link href="/payroll"><Wallet className="size-3.5" /> View payroll</Link></Button>}
          <Button asChild size="sm" variant="ghost"><Link href="/hr/letters"><FileText className="size-3.5" /> Letters</Link></Button>
          <Button asChild size="sm" variant="ghost"><Link href="/hr/offboarding"><LogOut className="size-3.5" /> Offboard</Link></Button>
        </div>
      )}

      {/* Employee Journey */}
      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Employee journey</h2>
        <EmployeeJourney current={employee.stage} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="training">Training</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-md">
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
            <Card title="Today's status">
              {todayAtt ? <Badge tone={hrAttendanceStatusTone[todayAtt.status]}>{hrAttendanceStatusLabels[todayAtt.status]}</Badge> : <span className="text-sm text-muted-foreground">Not marked</span>}
              {todayAtt?.checkIn && <p className="mt-1 text-xs text-muted-foreground">In {todayAtt.checkIn}{todayAtt.checkOut ? ` · Out ${todayAtt.checkOut}` : ""}</p>}
            </Card>
            <Card title="Contract">
              {contract ? (
                <div className="text-sm">
                  <Badge tone={contract.status === "active" ? "success" : contract.status === "expiring" ? "warning" : "neutral"}>{contractStatusLabels[contract.status]}</Badge>
                  <p className="mt-1 text-xs text-muted-foreground">{contract.type === "custom" ? "Custom" : employmentTypeLabels[contract.type]}{contract.endDate ? ` · ends ${formatDate(contract.endDate)}` : " · no end date"}</p>
                </div>
              ) : <span className="text-sm text-muted-foreground">No contract on file</span>}
            </Card>
            <Card title="Qualifications">
              <ul className="text-sm text-foreground">
                {employee.qualifications.map((q, i) => <li key={i} className="text-xs text-muted-foreground">{q.degree} · {q.institution} ({q.year})</li>)}
              </ul>
            </Card>
            <Card title="Emergency contact">
              {employee.emergencyContacts.length > 0 ? (
                <p className="text-xs text-muted-foreground">{employee.emergencyContacts[0].name} ({employee.emergencyContacts[0].relationship}) · {employee.emergencyContacts[0].phone}</p>
              ) : <span className="text-sm text-muted-foreground">None recorded</span>}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="employment" className="mt-md">
          <div className="grid grid-cols-2 gap-sm text-sm sm:grid-cols-3">
            <Field label="Designation" value={desig?.title ?? "—"} />
            <Field label="Department" value={dept?.name ?? "—"} />
            <Field label="Employment type" value={employmentTypeLabels[employee.employmentType]} />
            <Field label="Joining date" value={formatDate(employee.joiningDate)} />
            <Field label="Confirmation" value={employee.confirmationDate ? formatDate(employee.confirmationDate) : "Pending"} />
            <Field label="Reporting manager" value={manager ? `${manager.firstName} ${manager.lastName}` : "—"} />
            {canSensitive && <Field label="Bank" value={`${employee.bankName ?? "—"} ${employee.bankAccountMasked ?? ""}`} />}
            {canSensitive && <Field label="Gross salary" value={formatMoney(employee.grossSalary)} />}
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="mt-md">
          {attendance.length === 0 ? <Empty message="No attendance records." /> : (
            <div className="flex flex-col gap-xs">
              {attendance.slice(0, 15).map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-sm rounded-md border border-border bg-surface p-sm text-sm">
                  <span className="text-foreground">{formatDate(a.date)}</span>
                  <div className="flex items-center gap-sm">
                    {a.checkIn && <span className="text-xs text-muted-foreground">{a.checkIn}–{a.checkOut ?? "—"}</span>}
                    <Badge tone={hrAttendanceStatusTone[a.status]}>{hrAttendanceStatusLabels[a.status]}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="leave" className="mt-md">
          <div className="mb-md grid grid-cols-2 gap-sm sm:grid-cols-4">
            {balances.map((b) => (
              <div key={b.id} className="rounded-lg border border-border bg-surface p-sm">
                <p className="text-xs text-muted-foreground">{hrLeaveTypeLabels[b.leaveType]}</p>
                <p className="text-sm font-semibold text-foreground">{b.entitledDays - b.usedDays} <span className="text-xs text-muted-foreground">/ {b.entitledDays} left</span></p>
              </div>
            ))}
          </div>
          {leaves.length === 0 ? <Empty message="No leave requests." /> : (
            <div className="flex flex-col gap-xs">
              {leaves.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-sm rounded-md border border-border bg-surface p-sm text-sm">
                  <span className="min-w-0"><span className="text-foreground">{hrLeaveTypeLabels[l.leaveType]}</span> <span className="text-xs text-muted-foreground">{formatDate(l.startDate)} · {l.days}d</span></span>
                  <Badge tone={hrLeaveStatusTone[l.status]}>{l.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="performance" className="mt-md">
          {reviews.length === 0 ? <Empty message="No performance reviews yet." /> : (
            <div className="flex flex-col gap-sm">
              {reviews.map((r) => (
                <div key={r.id} className="rounded-lg border border-border bg-surface p-sm">
                  <div className="flex items-center justify-between gap-sm">
                    <span className="text-sm font-medium text-foreground">{db.performanceCycles.find((c) => c.id === r.cycleId)?.name ?? "Review"}</span>
                    <Badge tone={r.stage === "completed" ? "success" : "info"}>{reviewStageLabels[r.stage]}</Badge>
                  </div>
                  {r.overallRating && <p className="mt-1 text-xs text-muted-foreground">Overall rating: {r.overallRating}/5</p>}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="goals" className="mt-md">
          {goals.length === 0 ? <Empty message="No goals set." /> : (
            <div className="flex flex-col gap-sm">
              {goals.map((g) => (
                <div key={g.id} className="rounded-lg border border-border bg-surface p-sm">
                  <div className="flex items-center justify-between gap-sm">
                    <span className="truncate text-sm font-medium text-foreground">{g.title}</span>
                    <Badge tone={goalStatusTone[g.status]}>{g.status}</Badge>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-pill bg-surface-secondary">
                    <div className="h-full rounded-pill bg-primary" style={{ width: `${g.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="training" className="mt-md">
          {enrollments.length === 0 ? <Empty message="No training enrollments." /> : (
            <div className="flex flex-col gap-xs">
              {enrollments.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-sm rounded-md border border-border bg-surface p-sm text-sm">
                  <span className="truncate text-foreground">{courseName(e.courseId)}</span>
                  <Badge tone={enrollmentStatusTone[e.status]}>{e.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents" className="mt-md">
          {documents.length === 0 ? <Empty message="No documents." /> : (
            <div className="flex flex-col gap-xs">
              {documents.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-sm rounded-md border border-border bg-surface p-sm text-sm">
                  <span className="text-foreground">{staffDocumentTypeLabels[d.type]}</span>
                  <Badge tone={staffDocumentStatusTone[d.status]}>{d.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="assets" className="mt-md">
          {assets.length === 0 ? <Empty message="No assets assigned." /> : (
            <div className="flex flex-col gap-xs">
              {assets.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-sm rounded-md border border-border bg-surface p-sm text-sm">
                  <span className="text-foreground">{a.assetName}</span>
                  <span className="text-xs text-muted-foreground">{a.assetTag} · {formatDate(a.assignedAt)}</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="mt-md">
          {can("hr.manageStaff") && (
            <div className="mb-sm flex gap-xs">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note to the timeline…" aria-label="Timeline note" />
              <Button size="sm" onClick={submitNote}><StickyNote className="size-3.5" /> Add</Button>
            </div>
          )}
          {timeline.length === 0 ? <Empty message="No timeline events." /> : (
            <ol className="relative flex flex-col gap-sm border-l border-border pl-md">
              {timeline.map((t) => (
                <li key={t.id} className="relative">
                  <span className="absolute -left-[21px] top-1 size-2 rounded-pill bg-primary" aria-hidden="true" />
                  <p className="text-sm font-medium text-foreground">{t.title}</p>
                  {t.detail && <p className="text-xs text-muted-foreground">{t.detail}</p>}
                  <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                </li>
              ))}
            </ol>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-md">
      <h3 className="mb-sm text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{message}</div>;
}
