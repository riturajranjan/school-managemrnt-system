"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { teacherById } from "@/lib/data/seed/academics";
import type { ManagedClass } from "@/lib/types/academics";
import { cn } from "@/lib/utils";

export function classCapacity(c: ManagedClass): { capacity: number; enrolled: number } {
  return c.sections.reduce((acc, s) => ({ capacity: acc.capacity + s.capacity, enrolled: acc.enrolled + s.enrolledCount }), { capacity: 0, enrolled: 0 });
}

export function buildClassColumns(): ColumnDef<ManagedClass>[] {
  return [
    {
      id: "name",
      header: "Class",
      alwaysVisible: true,
      sortValue: (c) => c.order,
      cell: (c) => (
        <div>
          <p className="text-sm font-medium text-foreground">{c.name}</p>
          <p className="text-xs text-muted-foreground">Grade {c.order}</p>
        </div>
      ),
    },
    {
      id: "sections",
      header: "Sections",
      cell: (c) => <span className="text-sm text-foreground">{c.sections.map((s) => s.name).join(", ") || "—"}</span>,
    },
    {
      id: "classTeacher",
      header: "Class teacher(s)",
      cell: (c) => (
        <span className="text-xs text-muted-foreground">
          {c.sections
            .map((s) => teacherById(s.classTeacherId)?.name)
            .filter(Boolean)
            .join(", ") || "Unassigned"}
        </span>
      ),
      defaultVisible: false,
    },
    {
      id: "students",
      header: "Students",
      sortValue: (c) => classCapacity(c).enrolled,
      cell: (c) => {
        const { capacity, enrolled } = classCapacity(c);
        const nearFull = capacity > 0 && enrolled / capacity > 0.9;
        return (
          <span className={cn("text-sm", nearFull ? "font-medium text-warning" : "text-foreground")}>
            {enrolled} / {capacity}
          </span>
        );
      },
    },
    {
      id: "subjects",
      header: "Subjects",
      cell: (c) => <span className="text-sm text-foreground">{c.sections.length > 0 ? "View" : "—"}</span>,
      defaultVisible: false,
    },
    {
      id: "status",
      header: "Status",
      align: "right",
      cell: (c) => <Badge tone={c.status === "active" ? "success" : "neutral"}>{c.status}</Badge>,
    },
  ];
}

export function ClassMobileCard({ schoolClass, onOpen }: { schoolClass: ManagedClass; onOpen: () => void }) {
  const { capacity, enrolled } = classCapacity(schoolClass);
  const teacherNames = schoolClass.sections.map((s) => teacherById(s.classTeacherId)?.name).filter(Boolean);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="surface-3d flex w-full min-h-11 flex-col gap-1 rounded-lg border border-border bg-surface p-sm text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
    >
      <div className="flex items-center justify-between gap-xs">
        <p className="text-sm font-semibold text-foreground">{schoolClass.name}</p>
        <Badge tone={schoolClass.status === "active" ? "success" : "neutral"}>{schoolClass.status}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {schoolClass.sections.length} section{schoolClass.sections.length === 1 ? "" : "s"} · {enrolled}/{capacity} students
      </p>
      <p className="truncate text-xs text-muted-foreground">{teacherNames.join(", ") || "No class teacher assigned"}</p>
    </button>
  );
}

export function useGoToClass() {
  const router = useRouter();
  return (id: string) => router.push(`/academics/classes/${id}`);
}
