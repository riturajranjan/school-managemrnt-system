"use client";

// My classes (Phase 9J) — real PostgreSQL/API cutover. The authenticated
// teacher's own real TeachingAssignments, resolved via their real Staff.id
// server-side (GET /api/teaching-assignments/mine) — never the fake
// CURRENT_TEACHER_ID / mock subjectAssignments.
import Link from "next/link";
import { useMyTeachingAssignments } from "@/lib/hooks/api/use-staff-api";

export default function TeacherClassesPage() {
  const { data: assignments, loading, error } = useMyTeachingAssignments();

  const bySection = new Map<string, { className: string; name: string; assignments: typeof assignments }>();
  for (const a of assignments) {
    const existing = bySection.get(a.section.id);
    if (existing) existing.assignments.push(a);
    else bySection.set(a.section.id, { className: a.section.className, name: a.section.name, assignments: [a] });
  }

  return (
    <div className="flex flex-col gap-md">
      <div>
        <h1 className="text-lg font-semibold text-foreground">My classes</h1>
        <p className="text-xs text-muted-foreground">Sections and subjects you teach</p>
      </div>

      {error ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error}</p>
      ) : loading && assignments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          {[...bySection.entries()].map(([sectionId, section]) => (
            <div key={sectionId} className="rounded-lg border border-border bg-surface p-sm">
              <p className="text-sm font-semibold text-foreground">
                {section.className} — Section {section.name}
              </p>
              <div className="mt-sm flex flex-wrap gap-1">
                {section.assignments.map((a) => (
                  <span key={a.id} className="rounded-pill bg-surface-secondary px-sm py-0.5 text-xs text-foreground">
                    {a.subject.name}
                  </span>
                ))}
              </div>
              <div className="mt-sm flex gap-sm text-xs">
                <Link href={`/attendance/students?section=${sectionId}`} className="font-medium text-primary hover:underline">
                  Attendance
                </Link>
                <Link href={`/academics/timetable?section=${sectionId}`} className="font-medium text-primary hover:underline">
                  Timetable
                </Link>
                <Link href={`/academics/classes/${section.assignments[0]?.section.classId}`} className="font-medium text-primary hover:underline">
                  Class page
                </Link>
              </div>
            </div>
          ))}
          {bySection.size === 0 && <p className="text-sm text-muted-foreground">No classes assigned yet — this needs a real teaching Staff profile linked to your account.</p>}
        </div>
      )}
    </div>
  );
}
