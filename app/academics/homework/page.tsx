"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useMemo } from "react";
import { Plus } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { FilterBar } from "@/components/filters/filter-bar";
import type { FilterFieldConfig } from "@/components/filters/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { submissionTypeLabels } from "@/components/academics/homework/homework-meta";
import { usePermissions } from "@/components/providers/permissions-provider";
import { findClass, findSection } from "@/lib/data/seed/reference";
import { teacherById } from "@/lib/data/seed/academics";
import { useHomeworkList, useSubjects } from "@/lib/hooks/use-academics";
import { useSisStore } from "@/lib/hooks/use-store";
import { useUrlFilters } from "@/lib/hooks/use-url-filters";
import { homeworkStatusTone, type Homework } from "@/lib/types/academics";
import { formatDate } from "@/lib/utils";

const FILTER_DEFAULTS = { q: "", status: [] as string[], subject: [] as string[] };

function HomeworkPageContent() {
  const homework = useHomeworkList();
  const subjects = useSubjects();
  const db = useSisStore();
  const { can } = usePermissions();
  const router = useRouter();
  const { filters, setFilters, clearAll } = useUrlFilters(FILTER_DEFAULTS);

  const filtered = useMemo(() => {
    return homework.filter((h) => {
      if (filters.status.length > 0 && !filters.status.includes(h.status)) return false;
      if (filters.subject.length > 0 && !filters.subject.includes(h.subjectId)) return false;
      if (filters.q && !h.title.toLowerCase().includes(filters.q.toLowerCase())) return false;
      return true;
    });
  }, [homework, filters]);

  const filterFields: FilterFieldConfig[] = [
    {
      type: "multi-select",
      key: "status",
      label: "Status",
      options: ["draft", "scheduled", "published", "due-soon", "overdue", "closed", "evaluated", "archived"].map((s) => ({ value: s, label: s.replace("-", " ") })),
    },
    { type: "multi-select", key: "subject", label: "Subject", options: subjects.map((s) => ({ value: s.id, label: s.name })) },
  ];

  const columns: ColumnDef<Homework>[] = [
    {
      id: "title",
      header: "Homework",
      alwaysVisible: true,
      sortValue: (h) => h.title,
      cell: (h) => (
        <div>
          <p className="text-sm font-medium text-foreground">{h.title}</p>
          <p className="text-xs text-muted-foreground">{subjects.find((s) => s.id === h.subjectId)?.name}</p>
        </div>
      ),
    },
    { id: "class", header: "Class", cell: (h) => <span className="text-sm text-foreground">{findClass(h.classId)?.name}-{findSection(h.sectionId)?.section.name}</span> },
    { id: "teacher", header: "Teacher", cell: (h) => <span className="text-sm text-muted-foreground">{teacherById(h.teacherId)?.name}</span>, defaultVisible: false },
    { id: "due", header: "Due date", sortValue: (h) => new Date(h.dueDate).getTime(), cell: (h) => <span className="text-sm text-foreground">{formatDate(h.dueDate)}</span> },
    { id: "submissionType", header: "Submission", cell: (h) => <span className="text-xs text-muted-foreground">{submissionTypeLabels[h.submissionType]}</span>, defaultVisible: false },
    {
      id: "submitted",
      header: "Submitted",
      cell: (h) => {
        const subs = db.homeworkSubmissions.filter((s) => s.homeworkId === h.id);
        const done = subs.filter((s) => s.status !== "not-submitted").length;
        return <span className="text-sm text-foreground">{subs.length === 0 ? "—" : `${done}/${subs.length}`}</span>;
      },
    },
    { id: "status", header: "Status", align: "right", cell: (h) => <Badge tone={homeworkStatusTone[h.status]}>{h.status.replace("-", " ")}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Homework</h1>
          <p className="text-xs text-muted-foreground">Assignments, submissions and grading</p>
        </div>
        {can("homework.manage") && (
          <Button asChild size="sm">
            <Link href="/academics/homework/new">
              <Plus className="size-3.5" />
              Create homework
            </Link>
          </Button>
        )}
      </div>

      <FilterBar
        searchValue={filters.q}
        onSearchChange={(q) => setFilters({ q })}
        searchPlaceholder="Search homework…"
        fields={filterFields}
        values={filters}
        onChange={(key, value) => setFilters({ [key]: value })}
        onClearAll={clearAll}
      />

      <DataTable
        columns={columns}
        rows={filtered}
        getRowId={(h) => h.id}
        caption="Homework"
        onRowClick={(h) => router.push(`/academics/homework/${h.id}`)}
        renderMobileCard={(h) => (
          <button
            type="button"
            onClick={() => router.push(`/academics/homework/${h.id}`)}
            className="surface-3d flex w-full flex-col gap-1 rounded-lg border border-border bg-surface p-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">{h.title}</p>
              <Badge tone={homeworkStatusTone[h.status]}>{h.status.replace("-", " ")}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {findClass(h.classId)?.name}-{findSection(h.sectionId)?.section.name} · Due {formatDate(h.dueDate)}
            </p>
          </button>
        )}
        isFiltered={filters.q.length > 0 || filters.status.length > 0 || filters.subject.length > 0}
        emptyTitle="No homework yet"
        emptyDescription="Create the first assignment for your class."
      />
    </div>
  );
}

export default function HomeworkPage() {
  return (
    <Suspense fallback={<div className="h-40" />}>
      <HomeworkPageContent />
    </Suspense>
  );
}
