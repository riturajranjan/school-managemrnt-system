"use client";

import Papa from "papaparse";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Bus, FileWarning, GraduationCap, TrendingDown, Users, Wallet } from "lucide-react";
import { StudentsHeader } from "@/components/students/students-header";
import { StudentMobileCard, buildStudentColumns, buildStudentRowActions, useGoToStudent } from "@/components/students/student-table";
import { DataTable } from "@/components/data-table/data-table";
import { FilterBar } from "@/components/filters/filter-bar";
import { SavedViewsMenu } from "@/components/filters/saved-views-menu";
import type { FilterFieldConfig } from "@/components/filters/types";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatTile } from "@/components/ui/stat-tile";
import { schoolClasses, transportRoutes } from "@/lib/data/seed/reference";
import { useStudents } from "@/lib/hooks/use-students";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { useUrlFilters } from "@/lib/hooks/use-url-filters";
import { usePermissions } from "@/components/providers/permissions-provider";
import {
  activeStudentCount,
  attendanceRiskCount,
  feeRiskCount,
  genderSplit,
  missingDocumentStudentCount,
  newAdmissionsThisMonth,
  transportUserCount,
} from "@/lib/selectors/students-insights";
import { bulkAssignTransport, bulkUpdateStatus } from "@/lib/services/students-service";
import { studentStatusLabels, type StudentStatus } from "@/lib/types/students";

const STUDENT_FILTER_DEFAULTS = {
  q: "",
  class: [] as string[],
  status: [] as string[],
  feeStatus: [] as string[],
  transport: [] as string[],
  gender: [] as string[],
  missingDocs: false,
};

function StudentsPageContent() {
  const students = useStudents();
  const goToStudent = useGoToStudent();
  const { can } = usePermissions();
  const { filters, setFilters, clearAll } = useUrlFilters(STUDENT_FILTER_DEFAULTS);
  const [searchInput, setSearchInput] = useState(filters.q);
  const debouncedSearch = useDebouncedValue(searchInput, 250);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmArchive, setConfirmArchive] = useState(false);

  useEffect(() => {
    if (debouncedSearch !== filters.q) setFilters({ q: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (filters.class.length > 0 && !filters.class.includes(s.classId)) return false;
      if (filters.status.length > 0 && !filters.status.includes(s.status)) return false;
      if (filters.feeStatus.length > 0 && !filters.feeStatus.includes(s.fees.status)) return false;
      if (filters.transport.length > 0 && (!s.transport || !filters.transport.includes(s.transport.routeId))) return false;
      if (filters.gender.length > 0 && !filters.gender.includes(s.profile.gender)) return false;
      if (filters.missingDocs && !s.documents.some((d) => d.status === "missing" || d.status === "re-upload-requested")) return false;
      if (filters.q) {
        const haystack = `${s.profile.firstName} ${s.profile.lastName} ${s.admissionNumber} ${s.rollNumber ?? ""}`.toLowerCase();
        if (!haystack.includes(filters.q.toLowerCase())) return false;
      }
      return true;
    });
  }, [students, filters]);

  const filterFields: FilterFieldConfig[] = [
    { type: "multi-select", key: "class", label: "Class", options: schoolClasses.map((c) => ({ value: c.id, label: c.name })) },
    {
      type: "multi-select",
      key: "status",
      label: "Status",
      options: Object.entries(studentStatusLabels).map(([value, label]) => ({ value, label })),
    },
    {
      type: "multi-select",
      key: "feeStatus",
      label: "Fee status",
      options: [
        { value: "paid", label: "Paid" },
        { value: "partial", label: "Partial" },
        { value: "pending", label: "Pending" },
        { value: "overdue", label: "Overdue" },
      ],
    },
    { type: "multi-select", key: "transport", label: "Transport route", options: transportRoutes.map((r) => ({ value: r.id, label: r.name })) },
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
    { type: "toggle", key: "missingDocs", label: "Missing documents only" },
  ];

  const columns = useMemo(() => buildStudentColumns(), []);
  const rowActions = buildStudentRowActions({
    onMessage: () => {},
    onExport: (s) => exportRows([s]),
    onArchive: (s) => bulkUpdateStatus([s.id], "archived", "Administrator"),
  });

  function exportRows(rows: typeof students) {
    const csv = Papa.unparse(
      rows.map((s) => ({
        Student: `${s.profile.firstName} ${s.profile.lastName}`,
        "Admission number": s.admissionNumber,
        Class: schoolClasses.find((c) => c.id === s.classId)?.name ?? "",
        Status: s.status,
        "Fee status": s.fees.status,
        Attendance: `${s.attendance.presentPercent}%`,
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

  const gender = genderSplit(students);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <StudentsHeader onExport={() => exportRows(filtered)} />

      <section aria-label="Student summary" className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <StatTile label="Active students" value={String(activeStudentCount(students))} icon={Users} tone="success" />
        <StatTile label="New admissions" value={String(newAdmissionsThisMonth(students))} icon={GraduationCap} tone="info" hint="Last 30 days" />
        <StatTile label="Boys / Girls" value={`${gender.boys} / ${gender.girls}`} icon={Users} tone="neutral" />
        <StatTile label="Attendance risk" value={String(attendanceRiskCount(students))} icon={TrendingDown} tone="warning" hint="< 75% present" />
        <StatTile label="Fee risk" value={String(feeRiskCount(students))} icon={Wallet} tone="error" />
        <StatTile label="Missing documents" value={String(missingDocumentStudentCount(students))} icon={FileWarning} tone="warning" />
        <StatTile label="Transport users" value={String(transportUserCount(students))} icon={Bus} tone="info" />
      </section>

      <FilterBar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search students, admission number…"
        fields={filterFields}
        values={filters}
        onChange={(key, value) => setFilters({ [key]: value })}
        onClearAll={() => {
          setSearchInput("");
          clearAll();
        }}
        trailingActions={<SavedViewsMenu scope="students" currentFilters={filters} onApply={(saved) => setFilters(saved as Partial<typeof STUDENT_FILTER_DEFAULTS>)} />}
      />

      <DataTable
        columns={columns}
        rows={filtered}
        getRowId={(s) => s.id}
        caption="Students"
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
        isFiltered={filters.q.length > 0 || filters.class.length > 0 || filters.status.length > 0 || filters.feeStatus.length > 0 || filters.missingDocs}
        emptyTitle="No students yet"
        emptyDescription="Enroll students from Admissions or add them directly."
        bulkActionBar={
          <div className="flex flex-wrap items-center gap-sm rounded-lg border border-border bg-surface-secondary px-sm py-sm text-sm">
            <span className="font-medium text-foreground">{selectedIds.size} selected</span>
            <div className="ml-auto flex flex-wrap gap-xs">
              {(["active", "inactive"] as StudentStatus[]).map((status) => (
                <Button
                  key={status}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    bulkUpdateStatus([...selectedIds], status, "Administrator");
                    setSelectedIds(new Set());
                  }}
                >
                  Mark {studentStatusLabels[status]}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const route = transportRoutes[0];
                  bulkAssignTransport([...selectedIds], route.id, route.name, "Administrator");
                  setSelectedIds(new Set());
                }}
              >
                <Bus className="size-3.5" />
                Assign {transportRoutes[0].name}
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportRows(students.filter((s) => selectedIds.has(s.id)))}>
                Export selected
              </Button>
              <Button variant="ghost" size="sm" className="text-error" onClick={() => setConfirmArchive(true)}>
                Archive
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                Clear
              </Button>
            </div>
          </div>
        }
      />

      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={`Archive ${selectedIds.size} student${selectedIds.size === 1 ? "" : "s"}?`}
        description="Archived students are hidden from active rosters but their records are preserved and can be restored."
        confirmLabel="Archive"
        destructive
        onConfirm={() => {
          bulkUpdateStatus([...selectedIds], "archived", "Administrator");
          setSelectedIds(new Set());
        }}
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
