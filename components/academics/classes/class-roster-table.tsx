"use client";

// Class-roster rendering for the academics module, which still reads the mock
// `Student` shape from the store. Kept separate from the Phase-4 (real-API)
// student-table so each can evolve independently.
import type { ColumnDef } from "@/components/data-table/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { findSection } from "@/lib/data/seed/reference";
import type { Student } from "@/lib/types/students";
import { studentStatusLabels } from "@/lib/types/students";
import { initialsOf } from "@/lib/utils";
import { studentStatusTone } from "@/components/students/student-meta";

function name(s: Student) {
  return `${s.profile.firstName} ${s.profile.lastName}`;
}

export function buildClassRosterColumns(): ColumnDef<Student>[] {
  return [
    {
      id: "student",
      header: "Student",
      alwaysVisible: true,
      sortValue: (s) => name(s),
      cell: (s) => (
        <div className="flex items-center gap-sm">
          <Avatar className="size-8">
            <AvatarFallback>{initialsOf(s.profile.firstName, s.profile.lastName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{name(s)}</p>
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
      id: "section",
      header: "Section",
      cell: (s) => <span className="text-sm text-foreground">{findSection(s.sectionId)?.section.name ?? "—"}</span>,
    },
    {
      id: "status",
      header: "Status",
      align: "right",
      cell: (s) => <Badge tone={studentStatusTone[s.status]}>{studentStatusLabels[s.status]}</Badge>,
    },
  ];
}

export function ClassRosterMobileCard({ student, onOpen }: { student: Student; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="surface-3d flex w-full min-h-11 items-center gap-sm rounded-lg border border-border bg-surface p-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
    >
      <Avatar className="size-10 shrink-0">
        <AvatarFallback>{initialsOf(student.profile.firstName, student.profile.lastName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-xs">
          <p className="truncate text-sm font-semibold text-foreground">{name(student)}</p>
          <Badge tone={studentStatusTone[student.status]} className="shrink-0">
            {studentStatusLabels[student.status]}
          </Badge>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {student.admissionNumber} · {findSection(student.sectionId)?.section.name}
        </p>
      </div>
    </button>
  );
}
