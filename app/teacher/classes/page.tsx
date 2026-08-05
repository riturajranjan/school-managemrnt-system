"use client";

import Link from "next/link";
import { findClass, findSection } from "@/lib/data/seed/reference";
import { CURRENT_TEACHER_ID } from "@/lib/current-user";
import { useSisStore } from "@/lib/hooks/use-store";

export default function TeacherClassesPage() {
  const db = useSisStore();
  const assignments = db.subjectAssignments.filter((a) => a.primaryTeacherId === CURRENT_TEACHER_ID);
  const bySection = new Map<string, typeof assignments>();
  for (const a of assignments) bySection.set(a.sectionId, [...(bySection.get(a.sectionId) ?? []), a]);

  return (
    <div className="flex flex-col gap-md">
      <div>
        <h1 className="text-lg font-semibold text-foreground">My classes</h1>
        <p className="text-xs text-muted-foreground">Sections and subjects you teach</p>
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        {[...bySection.entries()].map(([sectionId, subjectAssignments]) => {
          const section = findSection(sectionId);
          const studentCount = db.students.filter((s) => s.sectionId === sectionId && s.status === "active").length;
          return (
            <div key={sectionId} className="rounded-lg border border-border bg-surface p-sm">
              <p className="text-sm font-semibold text-foreground">
                {section?.schoolClass.name} — Section {section?.section.name}
              </p>
              <p className="text-xs text-muted-foreground">{studentCount} students</p>
              <div className="mt-sm flex flex-wrap gap-1">
                {subjectAssignments.map((a) => (
                  <span key={a.id} className="rounded-pill bg-surface-secondary px-sm py-0.5 text-xs text-foreground">
                    {db.subjects.find((s) => s.id === a.subjectId)?.name}
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
                <Link href={`/academics/classes/${findClass(section?.schoolClass.id ?? "")?.id}`} className="font-medium text-primary hover:underline">
                  Class page
                </Link>
              </div>
            </div>
          );
        })}
        {bySection.size === 0 && <p className="text-sm text-muted-foreground">No classes assigned yet.</p>}
      </div>
    </div>
  );
}
