"use client";

import Papa from "papaparse";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, FileWarning, GraduationCap, TrendingUp, UserCheck2, Users, Wallet } from "lucide-react";
import { AdmissionsHeader } from "@/components/admissions/admissions-header";
import { ApplicantMobileCard, buildApplicantColumns, buildApplicantRowActions, useGoToApplicant } from "@/components/admissions/applicant-table";
import { PipelineBoard } from "@/components/admissions/pipeline-board";
import { DataTable } from "@/components/data-table/data-table";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { FilterBar } from "@/components/filters/filter-bar";
import { SavedViewsMenu } from "@/components/filters/saved-views-menu";
import type { FilterFieldConfig } from "@/components/filters/types";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { Input } from "@/components/ui/input";
import { schoolClasses } from "@/lib/data/seed/reference";
import { useAdmissionApplications } from "@/lib/hooks/use-admissions";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { useUrlFilters } from "@/lib/hooks/use-url-filters";
import { usePermissions } from "@/components/providers/permissions-provider";
import {
  applicationsReceivedThisWeek,
  applicationsRequiringAction,
  averageProcessingDays,
  conversionRate,
  countByStage,
  feePendingApprovalCount,
  missingDocumentCount,
  mostRequestedClass,
  pendingInterviewCount,
  seatCapacityWarnings,
} from "@/lib/selectors/admissions-insights";
import { approveApplication, bulkMoveApplicationStage, createDraftApplication, rejectApplication } from "@/lib/services/admissions-service";
import { admissionSourceLabels, admissionStageDefinitions, type AdmissionStageKey } from "@/lib/types/admissions";

const ADMISSIONS_FILTER_DEFAULTS = {
  q: "",
  class: [] as string[],
  source: [] as string[],
  missingDocs: false,
  stage: "" as string,
};

function AdmissionsPageContent() {
  const applications = useAdmissionApplications();
  const goToApplicant = useGoToApplicant();
  const { can } = usePermissions();
  const { filters, setFilters, clearAll } = useUrlFilters(ADMISSIONS_FILTER_DEFAULTS);
  const [searchInput, setSearchInput] = useState(filters.q);
  const debouncedSearch = useDebouncedValue(searchInput, 250);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [confirmReject, setConfirmReject] = useState<string | null>(null);

  useEffect(() => {
    if (debouncedSearch !== filters.q) setFilters({ q: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const selectedStage = (filters.stage || null) as AdmissionStageKey | null;
  const stageCounts = useMemo(() => countByStage(applications), [applications]);

  const filtered = useMemo(() => {
    return applications.filter((app) => {
      if (selectedStage && app.stage !== selectedStage) return false;
      if (filters.class.length > 0 && !filters.class.includes(app.appliedClassId)) return false;
      if (filters.source.length > 0 && !filters.source.includes(app.source)) return false;
      if (filters.missingDocs && !app.documents.some((d) => d.status === "missing" || d.status === "re-upload-requested")) return false;
      if (filters.q) {
        const haystack = `${app.student.firstName} ${app.student.lastName} ${app.applicationNumber}`.toLowerCase();
        if (!haystack.includes(filters.q.toLowerCase())) return false;
      }
      return true;
    });
  }, [applications, selectedStage, filters]);

  const filterFields: FilterFieldConfig[] = [
    { type: "multi-select", key: "class", label: "Applied class", options: schoolClasses.map((c) => ({ value: c.id, label: c.name })) },
    { type: "multi-select", key: "source", label: "Source", options: Object.entries(admissionSourceLabels).map(([value, label]) => ({ value, label })) },
    { type: "toggle", key: "missingDocs", label: "Missing documents only" },
  ];

  const columns = useMemo(() => buildApplicantColumns(), []);
  // Rebuilt each render (cheap — a handful of small objects) so it can close
  // over `exportRows` without an unstable useMemo dependency.
  const rowActions = buildApplicantRowActions({
    onApprove: (app) => approveApplication(app.id, "Admission Officer"),
    onAssign: (app) => goToApplicant(app.id),
    onExport: (app) => exportRows([app]),
    onReject: (app) => setConfirmReject(app.id),
  });

  function exportRows(rows: typeof applications) {
    const csv = Papa.unparse(
      rows.map((app) => ({
        Applicant: `${app.student.firstName} ${app.student.lastName}`,
        "Application number": app.applicationNumber,
        "Applied class": schoolClasses.find((c) => c.id === app.appliedClassId)?.name ?? "",
        Stage: app.stage,
        Source: admissionSourceLabels[app.source],
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

  const capacityWarnings = seatCapacityWarnings(applications);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <AdmissionsHeader onImport={() => setImportOpen(true)} onExport={() => exportRows(filtered)} />

      <section aria-label="Admission pipeline">
        <PipelineBoard counts={stageCounts} selectedStage={selectedStage} onSelectStage={(stage) => setFilters({ stage: stage ?? "" })} />
      </section>

      <section aria-label="Admission insights" className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <StatTile label="This week" value={String(applicationsReceivedThisWeek(applications))} icon={Users} tone="info" hint="New applications" />
        <StatTile label="Conversion rate" value={`${conversionRate(applications)}%`} icon={TrendingUp} tone="success" hint="Enrolled ÷ processed" />
        <StatTile label="Avg. processing" value={`${averageProcessingDays(applications)}d`} icon={CalendarClock} tone="neutral" />
        <StatTile label="Most requested" value={mostRequestedClass(applications)} icon={GraduationCap} tone="info" />
        <StatTile label="Missing documents" value={String(missingDocumentCount(applications))} icon={FileWarning} tone="warning" />
        <StatTile label="Pending interviews" value={String(pendingInterviewCount(applications))} icon={UserCheck2} tone="info" />
        <StatTile label="Fee approvals due" value={String(feePendingApprovalCount(applications))} icon={Wallet} tone="warning" />
        <StatTile label="Needs action" value={String(applicationsRequiringAction(applications))} icon={AlertTriangle} tone="error" />
      </section>

      {capacityWarnings.length > 0 && (
        <div className="flex flex-wrap items-center gap-sm rounded-lg border border-warning/30 bg-warning/10 px-sm py-sm text-xs text-warning">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          <span className="font-medium">Seat capacity warning:</span>
          {capacityWarnings.slice(0, 3).map((w) => (
            <span key={w.classId}>
              {w.className} — {w.remaining} seat{w.remaining === 1 ? "" : "s"} left
            </span>
          ))}
        </div>
      )}

      <FilterBar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search applicants, application number…"
        fields={filterFields}
        values={filters}
        onChange={(key, value) => setFilters({ [key]: value })}
        onClearAll={() => {
          setSearchInput("");
          clearAll();
        }}
        trailingActions={
          <SavedViewsMenu
            scope="admissions"
            currentFilters={filters}
            onApply={(saved) => setFilters(saved as Partial<typeof ADMISSIONS_FILTER_DEFAULTS>)}
          />
        }
      />

      <DataTable
        columns={columns}
        rows={filtered}
        getRowId={(app) => app.id}
        caption="Admission applications"
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
        isFiltered={filters.q.length > 0 || filters.class.length > 0 || filters.source.length > 0 || filters.missingDocs || Boolean(selectedStage)}
        emptyTitle="No applications yet"
        emptyDescription="New enquiries and applications will show up here."
        bulkActionBar={
          <div className="flex flex-wrap items-center gap-sm rounded-lg border border-border bg-surface-secondary px-sm py-sm text-sm">
            <span className="font-medium text-foreground">{selectedIds.size} selected</span>
            <div className="ml-auto flex flex-wrap gap-xs">
              {admissionStageDefinitions.slice(0, 4).map((stage) => (
                <Button
                  key={stage.key}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    bulkMoveApplicationStage([...selectedIds], stage.key, "Admission Officer");
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

      <ConfirmDialog
        open={confirmReject !== null}
        onOpenChange={(open) => !open && setConfirmReject(null)}
        title="Reject this application?"
        description="The applicant and guardians will be notified. This can be reversed by moving the application to a different stage."
        confirmLabel="Reject application"
        destructive
        onConfirm={() => confirmReject && rejectApplication(confirmReject, "Does not meet admission criteria", "Admission Officer")}
      />

      <QuickImportDrawer open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

function QuickImportDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
      let created = 0;
      let skipped = 0;
      for (const row of parsed.data) {
        const className = row.appliedClass || row.className;
        const schoolClass = schoolClasses.find((c) => c.name.toLowerCase() === (className ?? "").toLowerCase());
        if (!row.firstName || !row.lastName || !schoolClass) {
          skipped += 1;
          continue;
        }
        createDraftApplication({
          branchId: "main",
          session: "2026-2027",
          appliedClassId: schoolClass.id,
          student: { firstName: row.firstName, lastName: row.lastName, dob: row.dob ?? "", gender: "prefer-not-to-say", nationality: "Indian" },
          guardians: row.guardianFirstName
            ? [
                {
                  id: `g-${Date.now()}-${created}`,
                  role: "guardian",
                  firstName: row.guardianFirstName,
                  lastName: row.lastName,
                  contact: { phone: row.guardianPhone ?? "" },
                  isPrimary: true,
                  isEmergencyContact: true,
                  authorizedPickup: true,
                  communicationPreference: "sms",
                },
              ]
            : [],
        });
        created += 1;
      }
      setResult({ created, skipped });
    };
    reader.readAsText(file);
  }

  return (
    <DetailDrawer open={open} onOpenChange={onOpenChange} title="Import applications" description="Bulk-create enquiries from a CSV">
      <div className="flex flex-col gap-md text-sm">
        <p className="text-muted-foreground">
          Upload a CSV with columns <code className="rounded bg-surface-secondary px-1 py-0.5">firstName</code>,{" "}
          <code className="rounded bg-surface-secondary px-1 py-0.5">lastName</code>,{" "}
          <code className="rounded bg-surface-secondary px-1 py-0.5">appliedClass</code>,{" "}
          <code className="rounded bg-surface-secondary px-1 py-0.5">guardianFirstName</code>,{" "}
          <code className="rounded bg-surface-secondary px-1 py-0.5">guardianPhone</code>. Rows create draft enquiries at the
          &quot;New enquiry&quot; stage — invalid rows are skipped, not silently dropped.
        </p>
        <Input
          type="file"
          accept=".csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        {result && (
          <div className="rounded-md border border-border bg-surface-secondary p-sm text-xs">
            <p className="font-medium text-foreground">{result.created} enquiries created</p>
            {result.skipped > 0 && <p className="text-warning">{result.skipped} rows skipped (missing required fields or unknown class)</p>}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          For a full validated bulk-import experience with column mapping and error review, use the Students import workflow at{" "}
          <span className="font-medium text-foreground">Students → Import students</span>.
        </p>
      </div>
    </DetailDrawer>
  );
}

export default function AdmissionsPage() {
  return (
    <Suspense fallback={<div className="h-40" />}>
      <AdmissionsPageContent />
    </Suspense>
  );
}
