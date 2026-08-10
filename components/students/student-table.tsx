"use client";

import { useRouter } from "next/navigation";
import { Archive, Download } from "lucide-react";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { StudentListItemDto } from "@/lib/api/contracts";
import { studentStatusLabels, type StudentStatus } from "@/lib/types/students";
import { initialsOf } from "@/lib/utils";
import { studentStatusTone } from "./student-meta";

// Columns render ONLY real Phase-4 student data. Attendance / fees / transport /
// academics columns were intentionally dropped — that data is owned by future
// modules and is not faked here (spec §5).

function classText(s: StudentListItemDto) {
  return [s.classLabel, s.sectionLabel].filter(Boolean).join(" · ") || "—";
}

const admissionTypeLabels: Record<string, string> = {
  new: "New",
  transfer: "Transfer",
  sibling: "Sibling",
  "staff-ward": "Staff ward",
  "management-quota": "Mgmt quota",
};

export function buildStudentColumns(): ColumnDef<StudentListItemDto>[] {
  return [
    {
      id: "student",
      header: "Student",
      alwaysVisible: true,
      sortValue: (s) => s.fullName,
      cell: (s) => (
        <div className="flex items-center gap-sm">
          <Avatar className="size-8">
            <AvatarFallback>{initialsOf(s.firstName, s.lastName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{s.fullName}</p>
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
      sortValue: (s) => classText(s),
      cell: (s) => <span className="text-sm text-foreground">{classText(s)}</span>,
    },
    {
      id: "gender",
      header: "Gender",
      cell: (s) => <span className="text-sm capitalize text-foreground">{s.gender.replace(/-/g, " ")}</span>,
      defaultVisible: false,
    },
    {
      id: "admissionType",
      header: "Admission type",
      cell: (s) => <span className="text-sm text-foreground">{admissionTypeLabels[s.admissionType] ?? s.admissionType}</span>,
      defaultVisible: false,
    },
    {
      id: "admissionDate",
      header: "Admission date",
      sortValue: (s) => new Date(s.admissionDate).getTime(),
      cell: (s) => <span className="text-xs text-muted-foreground">{new Date(s.admissionDate).toLocaleDateString("en-IN")}</span>,
    },
    {
      id: "status",
      header: "Status",
      align: "right",
      cell: (s) => (
        <Badge tone={studentStatusTone[s.status as StudentStatus] ?? "neutral"}>
          {studentStatusLabels[s.status as StudentStatus] ?? s.status}
        </Badge>
      ),
    },
  ];
}

export function buildStudentRowActions(actions: {
  onExport: (s: StudentListItemDto) => void;
  onArchive: (s: StudentListItemDto) => void;
}): RowAction<StudentListItemDto>[] {
  return [
    { key: "export", label: "Export", icon: <Download className="size-3.5" />, onSelect: actions.onExport },
    { key: "archive", label: "Archive", icon: <Archive className="size-3.5" />, onSelect: actions.onArchive, destructive: true, hidden: (s) => s.status === "archived" },
  ];
}

export function StudentMobileCard({
  student,
  selected,
  onToggleSelect,
  onOpen,
}: {
  student: StudentListItemDto;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="surface-3d flex w-full min-h-11 items-start gap-sm rounded-lg border border-border bg-surface p-sm text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
    >
      <input
        type="checkbox"
        checked={selected}
        onClick={(e) => e.stopPropagation()}
        onChange={onToggleSelect}
        className="mt-1 size-4 shrink-0 accent-primary"
        aria-label={`Select ${student.fullName}`}
      />
      <Avatar className="size-10 shrink-0">
        <AvatarFallback>{initialsOf(student.firstName, student.lastName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-xs">
          <p className="truncate text-sm font-semibold text-foreground">{student.fullName}</p>
          <Badge tone={studentStatusTone[student.status as StudentStatus] ?? "neutral"} className="shrink-0">
            {studentStatusLabels[student.status as StudentStatus] ?? student.status}
          </Badge>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {student.admissionNumber} · {classText(student)}
        </p>
      </div>
    </button>
  );
}

export function useGoToStudent() {
  const router = useRouter();
  return (id: string) => router.push(`/students/${id}`);
}
