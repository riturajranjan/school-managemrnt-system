"use client";

// Homework (Phase 9B) — real PostgreSQL/API cutover. Same layout as before
// (filter bar, DataTable, mobile cards); real Homework rows via
// GET /api/homework, real Subject filter options. Submissions/grading/
// submission-type were mock-only (no real submission model exists — see
// prisma/schema.prisma's Homework doc comment) and are dropped, not carried
// forward: no "Submission"/"Submitted" columns.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { FilterBar } from "@/components/filters/filter-bar";
import type { FilterFieldConfig } from "@/components/filters/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSubjects } from "@/lib/hooks/api/use-academics-subjects";
import { useHomeworkList } from "@/lib/hooks/api/use-homework-api";
import { useUrlFilters } from "@/lib/hooks/use-url-filters";
import type { HomeworkListItemDto, HomeworkStatusDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const FILTER_DEFAULTS = { q: "", status: [] as string[], subject: [] as string[] };
const statusTone: Record<HomeworkStatusDto, "neutral" | "info" | "success"> = { draft: "neutral", published: "info", closed: "success" };

function HomeworkPageContent() {
  const { can } = usePermissions();
  const router = useRouter();
  const { filters, setFilters, clearAll } = useUrlFilters(FILTER_DEFAULTS);
  const { data: subjects } = useSubjects();

  const { data: homework, loading, error } = useHomeworkList({
    status: filters.status[0], subjectId: filters.subject[0], search: filters.q || undefined,
  });

  const filterFields: FilterFieldConfig[] = [
    { type: "multi-select", key: "status", label: "Status", options: (["draft", "published", "closed"] as HomeworkStatusDto[]).map((s) => ({ value: s, label: s })) },
    { type: "multi-select", key: "subject", label: "Subject", options: subjects.map((s) => ({ value: s.id, label: s.name })) },
  ];

  const columns: ColumnDef<HomeworkListItemDto>[] = [
    {
      id: "title",
      header: "Homework",
      alwaysVisible: true,
      sortValue: (h) => h.title,
      cell: (h) => (
        <div>
          <p className="text-sm font-medium text-foreground">{h.title}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="size-1.5 shrink-0 rounded-pill" style={{ backgroundColor: h.subject.color }} aria-hidden="true" />
            {h.subject.name}
          </p>
        </div>
      ),
    },
    { id: "class", header: "Class", cell: (h) => <span className="text-sm text-foreground">{h.section.className}-{h.section.name}</span> },
    { id: "teacher", header: "Teacher", cell: (h) => <span className="text-sm text-muted-foreground">{h.teacher.name}</span>, defaultVisible: false },
    { id: "due", header: "Due date", sortValue: (h) => new Date(h.dueAt).getTime(), cell: (h) => <span className="text-sm text-foreground">{formatDate(h.dueAt)}</span> },
    { id: "students", header: "Students", cell: (h) => <span className="text-sm text-foreground">{h.studentCount}</span>, defaultVisible: false },
    { id: "status", header: "Status", align: "right", cell: (h) => <Badge tone={statusTone[h.status]}>{h.status}</Badge> },
  ];

  if (!can("homework.view")) {
    return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">You don&apos;t have permission to view homework.</p>;
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Homework</h1>
          <p className="text-xs text-muted-foreground">Assignments across your school</p>
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

      {error ? (
        <p className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">{error}</p>
      ) : loading && homework.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-2xl text-center text-sm text-muted-foreground">Loading homework…</div>
      ) : (
        <DataTable
          columns={columns}
          rows={homework}
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
                <Badge tone={statusTone[h.status]}>{h.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {h.section.className}-{h.section.name} · Due {formatDate(h.dueAt)}
              </p>
            </button>
          )}
          isFiltered={filters.q.length > 0 || filters.status.length > 0 || filters.subject.length > 0}
          emptyTitle="No homework yet"
          emptyDescription="Create the first assignment for your class."
        />
      )}
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
