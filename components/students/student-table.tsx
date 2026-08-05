"use client";

import { useRouter } from "next/navigation";
import { Archive, Bus, Download, Mail } from "lucide-react";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { findClass, findSection } from "@/lib/data/seed/reference";
import type { Student } from "@/lib/types/students";
import { studentStatusLabels } from "@/lib/types/students";
import { initialsOf } from "@/lib/utils";
import { feeStatusTone, studentStatusTone } from "./student-meta";

function studentName(s: Student) {
  return `${s.profile.firstName} ${s.profile.lastName}`;
}

export function buildStudentColumns(): ColumnDef<Student>[] {
  return [
    {
      id: "student",
      header: "Student",
      alwaysVisible: true,
      sortValue: (s) => studentName(s),
      cell: (s) => (
        <div className="flex items-center gap-sm">
          <Avatar className="size-8">
            <AvatarFallback>{initialsOf(s.profile.firstName, s.profile.lastName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{studentName(s)}</p>
            <p className="truncate text-xs text-muted-foreground">{s.admissionNumber}</p>
          </div>
        </div>
      ),
    },
    {
      id: "roll",
      header: "Roll no.",
      sortValue: (s) => s.rollNumber ?? "",
      cell: (s) => <span className="text-sm text-foreground">{s.rollNumber ?? "—"}</span>,
    },
    {
      id: "class",
      header: "Class",
      sortValue: (s) => findClass(s.classId)?.order ?? 0,
      cell: (s) => (
        <span className="text-sm text-foreground">
          {findClass(s.classId)?.name} · {findSection(s.sectionId)?.section.name}
        </span>
      ),
    },
    {
      id: "parent",
      header: "Parent",
      cell: () => <span className="text-sm text-muted-foreground">—</span>,
      defaultVisible: false,
    },
    {
      id: "attendance",
      header: "Attendance",
      sortValue: (s) => s.attendance.presentPercent,
      cell: (s) => (
        <span className={s.attendance.presentPercent < 75 ? "text-error font-medium" : "text-foreground"}>{s.attendance.presentPercent}%</span>
      ),
    },
    {
      id: "fees",
      header: "Fee status",
      cell: (s) => <Badge tone={feeStatusTone[s.fees.status]}>{s.fees.status}</Badge>,
    },
    {
      id: "transport",
      header: "Transport",
      cell: (s) => (s.transport ? <span className="inline-flex items-center gap-1 text-xs text-foreground"><Bus className="size-3" />{s.transport.routeName}</span> : <span className="text-xs text-muted-foreground">—</span>),
      defaultVisible: false,
    },
    {
      id: "academicStatus",
      header: "Academic status",
      sortValue: (s) => s.academics.overallPercent,
      cell: (s) => <span className="text-sm text-foreground">{s.academics.overallPercent}%</span>,
      defaultVisible: false,
    },
    {
      id: "admissionDate",
      header: "Admission date",
      sortValue: (s) => new Date(s.admissionDate).getTime(),
      cell: (s) => <span className="text-xs text-muted-foreground">{new Date(s.admissionDate).toLocaleDateString("en-IN")}</span>,
      defaultVisible: false,
    },
    {
      id: "status",
      header: "Status",
      align: "right",
      cell: (s) => <Badge tone={studentStatusTone[s.status]}>{studentStatusLabels[s.status]}</Badge>,
    },
  ];
}

export function buildStudentRowActions(actions: { onMessage: (s: Student) => void; onExport: (s: Student) => void; onArchive: (s: Student) => void }): RowAction<Student>[] {
  return [
    { key: "message", label: "Send message", icon: <Mail className="size-3.5" />, onSelect: actions.onMessage },
    { key: "export", label: "Export", icon: <Download className="size-3.5" />, onSelect: actions.onExport },
    { key: "archive", label: "Archive", icon: <Archive className="size-3.5" />, onSelect: actions.onArchive, destructive: true, hidden: (s) => s.status === "archived" },
  ];
}

export function StudentMobileCard({ student, selected, onToggleSelect, onOpen }: { student: Student; selected: boolean; onToggleSelect: () => void; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="surface-3d flex w-full min-h-11 items-start gap-sm rounded-lg border border-border bg-surface p-sm text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
    >
      <input type="checkbox" checked={selected} onClick={(e) => e.stopPropagation()} onChange={onToggleSelect} className="mt-1 size-4 shrink-0 accent-primary" aria-label={`Select ${studentName(student)}`} />
      <Avatar className="size-10 shrink-0">
        <AvatarFallback>{initialsOf(student.profile.firstName, student.profile.lastName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-xs">
          <p className="truncate text-sm font-semibold text-foreground">{studentName(student)}</p>
          <Badge tone={studentStatusTone[student.status]} className="shrink-0">
            {studentStatusLabels[student.status]}
          </Badge>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {student.admissionNumber} · {findClass(student.classId)?.name}-{findSection(student.sectionId)?.section.name}
        </p>
        <div className="mt-1 flex items-center gap-sm text-xs">
          <span className={student.attendance.presentPercent < 75 ? "text-error font-medium" : "text-muted-foreground"}>{student.attendance.presentPercent}% attendance</span>
          <Badge tone={feeStatusTone[student.fees.status]}>{student.fees.status}</Badge>
        </div>
      </div>
    </button>
  );
}

export function useGoToStudent() {
  const router = useRouter();
  return (id: string) => router.push(`/students/${id}`);
}
