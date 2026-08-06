"use client";

import { useParams } from "next/navigation";
import { useMemo } from "react";
import { UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useExam, useExamClasses } from "@/lib/hooks/use-exams";
import { useStudents } from "@/lib/hooks/use-students";
import { toggleStudentExclusion } from "@/lib/services/exam-service";

export default function ExamStudentsPage() {
  const params = useParams<{ examId: string }>();
  const exam = useExam(params.examId);
  const examClasses = useExamClasses(params.examId);
  const classes = useManagedClasses();
  const students = useStudents();
  const { can } = usePermissions();
  const canManage = can("exams.manageSchedule");

  const rows = useMemo(
    () =>
      examClasses.map((ec) => {
        const schoolClass = classes.find((c) => c.id === ec.classId);
        const section = schoolClass?.sections.find((s) => s.id === ec.sectionId);
        const sectionStudents = students
          .filter((s) => s.sectionId === ec.sectionId)
          .sort((a, b) => (a.rollNumber ?? "").localeCompare(b.rollNumber ?? ""));
        return { examClass: ec, className: schoolClass?.name ?? ec.classId, sectionName: section?.name ?? "", students: sectionStudents };
      }),
    [examClasses, classes, students],
  );

  if (!exam) return null;

  const totalEligible = rows.reduce((sum, r) => sum + r.students.length - r.examClass.excludedStudentIds.length, 0);
  const totalExcluded = rows.reduce((sum, r) => sum + r.examClass.excludedStudentIds.length, 0);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Students — {exam.name}</h1>
        <p className="text-xs text-muted-foreground">
          {totalEligible} eligible{totalExcluded > 0 ? `, ${totalExcluded} excluded` : ""} across {rows.length} section{rows.length === 1 ? "" : "s"}
        </p>
      </div>

      {rows.length === 0 && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No classes selected for this exam yet.</p>}

      {rows.map((row) => (
        <div key={row.examClass.id} className="rounded-lg border border-border bg-surface p-md">
          <div className="mb-sm flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              {row.className} — Section {row.sectionName}
            </h2>
            <Badge tone="neutral">{row.students.length - row.examClass.excludedStudentIds.length} eligible</Badge>
          </div>
          <ul className="flex flex-col divide-y divide-border">
            {row.students.map((student) => {
              const excluded = row.examClass.excludedStudentIds.includes(student.id);
              return (
                <li key={student.id} className="flex items-center justify-between gap-sm py-1.5">
                  <div className="min-w-0">
                    <p className={`truncate text-sm ${excluded ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {student.profile.firstName} {student.profile.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">Roll {student.rollNumber ?? "—"} · {student.admissionNumber}</p>
                  </div>
                  {canManage ? (
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <UserX className="size-3.5" aria-hidden="true" />
                      Exclude
                      <Checkbox checked={excluded} onCheckedChange={() => toggleStudentExclusion(row.examClass.id, student.id)} aria-label={`Exclude ${student.profile.firstName} ${student.profile.lastName}`} />
                    </label>
                  ) : (
                    excluded && <Badge tone="neutral">Excluded</Badge>
                  )}
                </li>
              );
            })}
            {row.students.length === 0 && <li className="py-1.5 text-sm text-muted-foreground">No students enrolled in this section.</li>}
          </ul>
        </div>
      ))}
    </div>
  );
}
