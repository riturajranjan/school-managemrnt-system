"use client";

import Papa from "papaparse";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { StudentsHeader } from "@/components/students/students-header";
import { StudentMobileCard, buildStudentColumns, buildStudentRowActions, useGoToStudent } from "@/components/students/student-table";
import { DataTable } from "@/components/data-table/data-table";
import { FilterBar } from "@/components/filters/filter-bar";
import type { FilterFieldConfig } from "@/components/filters/types";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatTile } from "@/components/ui/stat-tile";
import { useStudentList, archiveStudentRequest } from "@/lib/hooks/api/use-students";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { useUrlFilters } from "@/lib/hooks/use-url-filters";
import { usePermissions } from "@/components/providers/permissions-provider";
import type { StudentListItemDto } from "@/lib/api/contracts";
import { studentStatusLabels } from "@/lib/types/students";

const PAGE_SIZE = 20;

const STUDENT_FILTER_DEFAULTS = {
  q: "",
  status: [] as string[],
  gender: [] as string[],
  admissionType: [] as string[],
  page: "1",
};

function StudentsPageContent() {
  const goToStudent = useGoToStudent();
  const { can } = usePermissions();
  const { filters, setFilters, clearAll } = useUrlFilters(STUDENT_FILTER_DEFAULTS);
  const [searchInput, setSearchInput] = useState(filters.q);
  const debouncedSearch = useDebouncedValue(searchInput, 250);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (debouncedSearch !== filters.q) setFilters({ q: debouncedSearch, page: "1" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const page = Math.max(1, Number(filters.page) || 1);
  // Real, server-backed list — search / filters / pagination all go to the API.
  const { data: students, meta, loading, error, reload } = useStudentList({
    page,
    pageSize: PAGE_SIZE,
    search: filters.q || undefined,
    status: filters.status,
    gender: filters.gender,
    admissionType: filters.admissionType,
  });

  const filterFields: FilterFieldConfig[] = [
    {
      type: "multi-select",
      key: "status",
      label: "Status",
      options: Object.entries(studentStatusLabels).map(([value, label]) => ({ value, label })),
    },
    {
      type: "multi-select",
      key: "gender",
      label: "Gender",
      options: [
        { value: "male", label: "Male" },
        { value: "female", label: "Female" },
        { value: "other", label: "Other" },
      ],
    },
    {
      type: "multi-select",
      key: "admissionType",
      label: "Admission type",
      options: [
        { value: "new", label: "New" },
        { value: "transfer", label: "Transfer" },
        { value: "sibling", label: "Sibling" },
        { value: "staff-ward", label: "Staff ward" },
        { value: "management-quota", label: "Management quota" },
      ],
    },
  ];

  const columns = useMemo(() => buildStudentColumns(), []);

  function exportRows(rows: StudentListItemDto[]) {
    const csv = Papa.unparse(
      rows.map((s) => ({
        Student: s.fullName,
        "Admission number": s.admissionNumber,
        Class: [s.classLabel, s.sectionLabel].filter(Boolean).join(" "),
        Gender: s.gender,
        "Admission type": s.admissionType,
        Status: s.status,
      })),
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "students-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function archiveOne(id: string) {
    setBusy(true);
    await archiveStudentRequest(id);
    setBusy(false);
    reload();
  }

  async function archiveSelected() {
    setBusy(true);
    for (const id of selectedIds) await archiveStudentRequest(id);
    setBusy(false);
    setSelectedIds(new Set());
    reload();
  }

  const rowActions = buildStudentRowActions({
    onExport: (s) => exportRows([s]),
    onArchive: (s) => void archiveOne(s.id),
  });

  const totalPages = meta?.totalPages ?? 1;
  const isFiltered = filters.q.length > 0 || filters.status.length > 0 || filters.gender.length > 0 || filters.admissionType.length > 0;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <StudentsHeader onExport={() => exportRows(students)} />

      <section aria-label="Student summary" className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Total students" value={meta ? String(meta.total) : "—"} icon={Users} tone="neutral" hint="Across current filters" />
      </section>

      <FilterBar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search students, admission number…"
        fields={filterFields}
        values={filters}
        onChange={(key, value) => setFilters({ [key]: value, page: "1" })}
        onClearAll={() => {
          setSearchInput("");
          clearAll();
        }}
      />

      {error ? (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load students: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : loading && students.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-2xl text-center text-sm text-muted-foreground">Loading students…</div>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={students}
            getRowId={(s) => s.id}
            caption="Students"
            pageSize={PAGE_SIZE}
            onRowClick={(s) => goToStudent(s.id)}
            renderMobileCard={(s) => (
              <StudentMobileCard
                student={s}
                selected={selectedIds.has(s.id)}
                onToggleSelect={() =>
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(s.id)) next.delete(s.id);
                    else next.add(s.id);
                    return next;
                  })
                }
                onOpen={() => goToStudent(s.id)}
              />
            )}
            selectable={can("students.edit")}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            rowActions={can("students.edit") ? rowActions : undefined}
            isFiltered={isFiltered}
            emptyTitle="No students found"
            emptyDescription="Adjust your search or filters, or add a student."
            bulkActionBar={
              <div className="flex flex-wrap items-center gap-sm rounded-lg border border-border bg-surface-secondary px-sm py-sm text-sm">
                <span className="font-medium text-foreground">{selectedIds.size} selected</span>
                <div className="ml-auto flex flex-wrap gap-xs">
                  <Button variant="outline" size="sm" onClick={() => exportRows(students.filter((s) => selectedIds.has(s.id)))}>
                    Export selected
                  </Button>
                  <Button variant="ghost" size="sm" className="text-error" disabled={busy} onClick={() => setConfirmArchive(true)}>
                    Archive
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                    Clear
                  </Button>
                </div>
              </div>
            }
          />

          {meta && totalPages > 1 && (
            <div className="flex items-center justify-between gap-sm text-sm">
              <span className="text-muted-foreground">
                Page {meta.page} of {totalPages} · {meta.total} total
              </span>
              <div className="flex gap-xs">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setFilters({ page: String(page - 1) })}>
                  <ChevronLeft className="size-3.5" /> Prev
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setFilters({ page: String(page + 1) })}>
                  Next <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={`Archive ${selectedIds.size} student${selectedIds.size === 1 ? "" : "s"}?`}
        description="Archived students are hidden from active rosters but their records are preserved."
        confirmLabel="Archive"
        destructive
        onConfirm={() => void archiveSelected()}
      />
    </div>
  );
}

export default function StudentsPage() {
  return (
    <Suspense fallback={<div className="h-40" />}>
      <StudentsPageContent />
    </Suspense>
  );
}
