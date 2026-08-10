"use client";

import Papa from "papaparse";
import { Suspense, useEffect, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, GraduationCap, UserX, Users } from "lucide-react";
import { AdmissionsHeader } from "@/components/admissions/admissions-header";
import { ApplicantMobileCard, buildApplicantColumns, buildApplicantRowActions, useGoToApplicant } from "@/components/admissions/applicant-table";
import { PipelineBoard } from "@/components/admissions/pipeline-board";
import { DataTable } from "@/components/data-table/data-table";
import { FilterBar } from "@/components/filters/filter-bar";
import type { FilterFieldConfig } from "@/components/filters/types";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { useAdmissionList, useAdmissionStats, changeStageRequest } from "@/lib/hooks/api/use-admissions";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { useUrlFilters } from "@/lib/hooks/use-url-filters";
import { usePermissions } from "@/components/providers/permissions-provider";
import type { AdmissionListItemDto } from "@/lib/api/contracts";
import { admissionSourceLabels, admissionStageDefinitions, type AdmissionStageKey } from "@/lib/types/admissions";

const PAGE_SIZE = 20;

const ADMISSIONS_FILTER_DEFAULTS = {
  q: "",
  source: [] as string[],
  stage: "" as string,
  page: "1",
};

function AdmissionsPageContent() {
  const goToApplicant = useGoToApplicant();
  const { can } = usePermissions();
  const { filters, setFilters, clearAll } = useUrlFilters(ADMISSIONS_FILTER_DEFAULTS);
  const [searchInput, setSearchInput] = useState(filters.q);
  const debouncedSearch = useDebouncedValue(searchInput, 250);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmReject, setConfirmReject] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (debouncedSearch !== filters.q) setFilters({ q: debouncedSearch, page: "1" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const selectedStage = (filters.stage || null) as AdmissionStageKey | null;
  const page = Math.max(1, Number(filters.page) || 1);

  const stats = useAdmissionStats();
  const { data: applications, meta, loading, error, reload } = useAdmissionList({
    page,
    pageSize: PAGE_SIZE,
    search: filters.q || undefined,
    stage: selectedStage ? [selectedStage] : undefined,
    source: filters.source,
  });

  // Pipeline counts come from the global stats endpoint (accurate across pages).
  const stageCounts = (stats.data?.byStage ?? {}) as Record<AdmissionStageKey, number>;

  const filterFields: FilterFieldConfig[] = [
    {
      type: "multi-select",
      key: "source",
      label: "Source",
      options: Object.entries(admissionSourceLabels).map(([value, label]) => ({ value, label })),
    },
  ];

  const columns = buildApplicantColumns();

  async function moveStage(id: string, stage: AdmissionStageKey, reason?: string) {
    setBusy(true);
    await changeStageRequest(id, stage, reason);
    setBusy(false);
    reload();
    stats.reload();
  }

  function exportRows(rows: AdmissionListItemDto[]) {
    const csv = Papa.unparse(
      rows.map((app) => ({
        Applicant: app.applicantName,
        "Application number": app.applicationNumber,
        "Applied class": app.appliedClass ?? "",
        Stage: app.stage,
        Source: app.source,
        "Submitted at": app.submittedAt ?? "",
      })),
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "admissions-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const rowActions = buildApplicantRowActions({
    onApprove: (app) => void moveStage(app.id, "approved"),
    onOpen: (app) => goToApplicant(app.id),
    onExport: (app) => exportRows([app]),
    onReject: (app) => setConfirmReject(app.id),
  });

  const totalPages = meta?.totalPages ?? 1;
  const isFiltered = filters.q.length > 0 || filters.source.length > 0 || Boolean(selectedStage);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <AdmissionsHeader onExport={() => exportRows(applications)} />

      <section aria-label="Admission pipeline">
        <PipelineBoard
          counts={stageCounts}
          selectedStage={selectedStage}
          onSelectStage={(stage) => setFilters({ stage: stage ?? "", page: "1" })}
        />
      </section>

      <section aria-label="Admission insights" className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Total applications" value={stats.data ? String(stats.data.total) : "—"} icon={Users} tone="info" />
        <StatTile label="Approved" value={stats.data ? String(stats.data.approved) : "—"} icon={CheckCircle2} tone="success" />
        <StatTile label="Enrolled" value={stats.data ? String(stats.data.enrolled) : "—"} icon={GraduationCap} tone="success" />
        <StatTile label="Rejected" value={stats.data ? String(stats.data.rejected) : "—"} icon={UserX} tone="error" />
      </section>

      <FilterBar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search applicants, application number…"
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
          Could not load applications: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : loading && applications.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-2xl text-center text-sm text-muted-foreground">Loading applications…</div>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={applications}
            getRowId={(app) => app.id}
            caption="Admission applications"
            pageSize={PAGE_SIZE}
            onRowClick={(app) => goToApplicant(app.id)}
            renderMobileCard={(app) => (
              <ApplicantMobileCard
                app={app}
                selected={selectedIds.has(app.id)}
                onToggleSelect={() =>
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(app.id)) next.delete(app.id);
                    else next.add(app.id);
                    return next;
                  })
                }
                onOpen={() => goToApplicant(app.id)}
              />
            )}
            selectable={can("admissions.edit")}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            rowActions={can("admissions.edit") ? rowActions : undefined}
            isFiltered={isFiltered}
            emptyTitle="No applications found"
            emptyDescription="Adjust your filters, or create a new application."
            bulkActionBar={
              <div className="flex flex-wrap items-center gap-sm rounded-lg border border-border bg-surface-secondary px-sm py-sm text-sm">
                <span className="font-medium text-foreground">{selectedIds.size} selected</span>
                <div className="ml-auto flex flex-wrap gap-xs">
                  {admissionStageDefinitions.slice(2, 5).map((stage) => (
                    <Button
                      key={stage.key}
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={async () => {
                        for (const id of selectedIds) await moveStage(id, stage.key);
                        setSelectedIds(new Set());
                      }}
                    >
                      Move to {stage.label}
                    </Button>
                  ))}
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
        open={confirmReject !== null}
        onOpenChange={(open) => !open && setConfirmReject(null)}
        title="Reject this application?"
        description="This can be reversed by moving the application to a different stage."
        confirmLabel="Reject application"
        destructive
        onConfirm={() => confirmReject && void moveStage(confirmReject, "rejected", "Does not meet admission criteria")}
      />
    </div>
  );
}

export default function AdmissionsPage() {
  return (
    <Suspense fallback={<div className="h-40" />}>
      <AdmissionsPageContent />
    </Suspense>
  );
}
