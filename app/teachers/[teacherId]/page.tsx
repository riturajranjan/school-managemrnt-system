"use client";

import Link from "next/link";
import { use } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { findClass, findSection } from "@/lib/data/seed/reference";
import { useTeacher } from "@/lib/hooks/use-academics";
import { useSisStore } from "@/lib/hooks/use-store";
import { lessonPlanStatusTone } from "@/lib/types/academics";
import { formatDate } from "@/lib/utils";

export default function TeacherDetailPage({ params }: { params: Promise<{ teacherId: string }> }) {
  const { teacherId } = use(params);
  const teacher = useTeacher(teacherId);
  const db = useSisStore();

  if (!teacher) {
    return (
      <div className="flex flex-col items-center gap-sm py-2xl text-center">
        <p className="text-sm font-medium text-foreground">Teacher not found</p>
        <Button asChild variant="outline">
          <Link href="/teachers">Back to Teachers</Link>
        </Button>
      </div>
    );
  }

  const assignments = db.subjectAssignments.filter((a) => a.primaryTeacherId === teacherId);
  const plans = db.lessonPlans.filter((p) => p.teacherId === teacherId).slice(0, 8);
  const homework = db.homework.filter((h) => h.teacherId === teacherId).slice(0, 8);

  return (
    <div className="flex flex-col gap-md">
      <div className="rounded-lg border border-border bg-surface p-md">
        <div className="flex items-center gap-xs">
          <h1 className="text-base font-semibold text-foreground">{teacher.name}</h1>
          <Badge tone={teacher.status === "active" ? "success" : "warning"}>{teacher.status.replace("-", " ")}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {teacher.department} · {teacher.employeeId} · {teacher.email}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <div className="rounded-lg border border-border p-sm">
          <h2 className="mb-xs text-sm font-semibold text-foreground">Classes &amp; subjects</h2>
          <ul className="flex flex-col gap-1">
            {assignments.map((a) => (
              <li key={a.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground">
                  {findClass(a.classId)?.name}-{findSection(a.sectionId)?.section.name}
                </span>
                <span className="text-xs text-muted-foreground">{db.subjects.find((s) => s.id === a.subjectId)?.name}</span>
              </li>
            ))}
            {assignments.length === 0 && <p className="text-sm text-muted-foreground">No assignments yet.</p>}
          </ul>
        </div>

        <div className="rounded-lg border border-border p-sm">
          <h2 className="mb-xs text-sm font-semibold text-foreground">Recent lesson plans</h2>
          <ul className="flex flex-col gap-1">
            {plans.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{formatDate(p.date)}</span>
                <Badge tone={lessonPlanStatusTone[p.status]}>{p.status}</Badge>
              </li>
            ))}
            {plans.length === 0 && <p className="text-sm text-muted-foreground">No lesson plans yet.</p>}
          </ul>
        </div>

        <div className="rounded-lg border border-border p-sm sm:col-span-2">
          <h2 className="mb-xs text-sm font-semibold text-foreground">Recent homework</h2>
          <ul className="flex flex-col gap-1">
            {homework.map((h) => (
              <li key={h.id} className="flex items-center justify-between text-sm">
                <Link href={`/academics/homework/${h.id}`} className="text-foreground hover:underline">
                  {h.title}
                </Link>
                <span className="text-xs text-muted-foreground">Due {formatDate(h.dueDate)}</span>
              </li>
            ))}
            {homework.length === 0 && <p className="text-sm text-muted-foreground">No homework assigned yet.</p>}
          </ul>
        </div>
      </div>
    </div>
  );
}
