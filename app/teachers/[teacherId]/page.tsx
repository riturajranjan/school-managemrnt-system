"use client";

// Teacher detail (Phase 9J) — real PostgreSQL/API cutover. Aggregates the
// existing real domains (TeachingAssignment, Timetable, Homework, Lesson
// Plans, Staff Attendance, Leave) via one server round-trip
// (GET /api/staff/[staffId]/teacher-detail) instead of the mock store. A
// section stays absent (not fabricated) when the viewer's own permissions
// don't cover that domain.
import Link from "next/link";
import { use } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTeacherDetail } from "@/lib/hooks/api/use-staff-api";
import type { LessonPlanStatusDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const lessonPlanStatusTone: Record<LessonPlanStatusDto, "neutral" | "info" | "success" | "error"> = { draft: "neutral", submitted: "info", approved: "success", rejected: "error", completed: "success" };
const statusTone = { active: "success", inactive: "warning", archived: "neutral" } as const;

export default function TeacherDetailPage({ params }: { params: Promise<{ teacherId: string }> }) {
  const { teacherId } = use(params);
  const { data: detail, loading, error } = useTeacherDetail(teacherId);

  if (loading) return <p className="py-2xl text-center text-sm text-muted-foreground">Loading…</p>;
  if (error || !detail) {
    return (
      <div className="flex flex-col items-center gap-sm py-2xl text-center">
        <p className="text-sm font-medium text-foreground">{error ?? "Teacher not found"}</p>
        <Button asChild variant="outline">
          <Link href="/teachers">Back to Teachers</Link>
        </Button>
      </div>
    );
  }

  const { staff } = detail;

  return (
    <div className="flex flex-col gap-md">
      <div className="rounded-lg border border-border bg-surface p-md">
        <div className="flex items-center gap-xs">
          <h1 className="text-base font-semibold text-foreground">{staff.name}</h1>
          <Badge tone={statusTone[staff.status]}>{staff.status}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {staff.department ?? "No department"} · {staff.employeeCode} · {staff.email ?? "No email on file"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatCard label="Sections/subjects" value={String(detail.teachingAssignments.length)} />
        <StatCard label="Attendance (90d)" value={detail.attendance?.percentage != null ? `${detail.attendance.percentage}%` : "—"} hint={detail.attendance === null ? "Not visible to you" : undefined} />
        <StatCard label="Leave pending" value={detail.leave ? String(detail.leave.pendingCount) : "—"} hint={detail.leave === null ? "Not visible to you" : undefined} />
        <StatCard label="Homework (open)" value={detail.homework ? String(detail.homework.total) : "—"} hint={detail.homework === null ? "Requires homework.view" : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <div className="rounded-lg border border-border p-sm">
          <h2 className="mb-xs text-sm font-semibold text-foreground">Classes &amp; subjects</h2>
          <ul className="flex flex-col gap-1">
            {detail.teachingAssignments.map((a) => (
              <li key={a.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground">
                  {a.section.className}-{a.section.name}
                </span>
                <span className="text-xs text-muted-foreground">{a.subject.name}</span>
              </li>
            ))}
            {detail.teachingAssignments.length === 0 && <p className="text-sm text-muted-foreground">No assignments yet.</p>}
          </ul>
        </div>

        <div className="rounded-lg border border-border p-sm">
          <h2 className="mb-xs text-sm font-semibold text-foreground">Timetable this week</h2>
          {detail.timetable === null ? (
            <p className="text-sm text-muted-foreground">Not visible to you (requires timetable.view).</p>
          ) : detail.timetable.entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No timetable entries yet.</p>
          ) : (
            <p className="text-sm text-foreground">
              {detail.timetable.entries.length} period{detail.timetable.entries.length === 1 ? "" : "s"} scheduled this week ·{" "}
              <Link href={`/academics/timetable?staffId=${staff.id}`} className="font-medium text-primary hover:underline">
                View timetable
              </Link>
            </p>
          )}
        </div>

        <div className="rounded-lg border border-border p-sm">
          <h2 className="mb-xs text-sm font-semibold text-foreground">Recent lesson plans</h2>
          {detail.lessonPlans === null ? (
            <p className="text-sm text-muted-foreground">Not visible to you (requires lessonPlans.view).</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {detail.lessonPlans.items.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{formatDate(p.plannedDate)}</span>
                  <Badge tone={lessonPlanStatusTone[p.status]}>{p.status}</Badge>
                </li>
              ))}
              {detail.lessonPlans.items.length === 0 && <p className="text-sm text-muted-foreground">No lesson plans yet.</p>}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border p-sm">
          <h2 className="mb-xs text-sm font-semibold text-foreground">Recent homework</h2>
          {detail.homework === null ? (
            <p className="text-sm text-muted-foreground">Not visible to you (requires homework.view).</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {detail.homework.items.map((h) => (
                <li key={h.id} className="flex items-center justify-between text-sm">
                  <Link href={`/academics/homework/${h.id}`} className="text-foreground hover:underline">
                    {h.title}
                  </Link>
                  <span className="text-xs text-muted-foreground">Due {formatDate(h.dueAt)}</span>
                </li>
              ))}
              {detail.homework.items.length === 0 && <p className="text-sm text-muted-foreground">No homework assigned yet.</p>}
            </ul>
          )}
        </div>

        {detail.leave !== null && (
          <div className="rounded-lg border border-border p-sm">
            <h2 className="mb-xs text-sm font-semibold text-foreground">Leave requests</h2>
            <ul className="flex flex-col gap-1">
              {detail.leave.items.map((l) => (
                <li key={l.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{l.leaveTypeName} · {formatDate(l.startDate)}</span>
                  <Badge tone={l.status === "approved" ? "success" : l.status === "rejected" ? "error" : l.status === "pending" ? "warning" : "neutral"}>{l.status}</Badge>
                </li>
              ))}
              {detail.leave.items.length === 0 && <p className="text-sm text-muted-foreground">No leave requests.</p>}
            </ul>
          </div>
        )}

        {detail.payroll.visible && (
          <div className="rounded-lg border border-border p-sm">
            <h2 className="mb-xs text-sm font-semibold text-foreground">Payroll</h2>
            <Button asChild size="sm" variant="outline">
              <Link href="/payroll/payslips">View payslips</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
