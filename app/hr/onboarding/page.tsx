"use client";

// Employee Onboarding (Production migration, Phase B, HR Sub-batch 4) — real
// PostgreSQL/API cutover. NOT SchoolOnboarding (platform-side) — this is a
// new employee's own checklist, always tied to a real Staff.id.
// Onboarding 1→many OnboardingTask; progress is always derived live from
// real task completion, never a stored percentage. hr.view/hr.manage RBAC —
// no new permission.
import Link from "next/link";
import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Plus, Search, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { completeOnboardingTaskRequest, createEmployeeOnboardingRequest, reopenOnboardingTaskRequest, useEmployeeOnboardings } from "@/lib/hooks/api/use-hr-api";
import { useStaffList } from "@/lib/hooks/api/use-staff-api";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { roleLabels } from "@/lib/permissions/roles";
import type { EmployeeOnboardingStatusDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const PAGE_SIZE = 20;

const statusLabels: Record<EmployeeOnboardingStatusDto, string> = {
  "not-started": "Not started", "in-progress": "In progress", completed: "Completed", cancelled: "Cancelled",
};
const statusTone: Record<EmployeeOnboardingStatusDto, "success" | "warning" | "error" | "neutral" | "info"> = {
  "not-started": "neutral", "in-progress": "info", completed: "success", cancelled: "error",
};

export default function OnboardingPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 250);
  const [statusFilter, setStatusFilter] = useState<EmployeeOnboardingStatusDto | "all">("all");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [staffId, setStaffId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [staffSearch, setStaffSearch] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const { data: onboardings, meta, loading, error, reload } = useEmployeeOnboardings({
    search: debouncedSearch || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    page,
    pageSize: PAGE_SIZE,
  });
  const { data: staffOptions } = useStaffList({ status: "active", search: staffSearch || undefined, pageSize: 50 });

  if (!capabilitiesLoading && !hasServerPermission("hr.view") && !hasServerPermission("hr.manage")) {
    return <PermissionDenied action="view onboarding" role={roleLabels[role]} backHref="/hr" />;
  }
  const canManage = hasServerPermission("hr.manage");
  const isFiltered = searchInput.trim().length > 0 || statusFilter !== "all";
  const totalPages = meta?.totalPages ?? 1;

  function resetForm() {
    setStaffId(""); setStartDate(new Date().toISOString().slice(0, 10)); setStaffSearch(""); setFormError(null);
  }

  async function submit() {
    setFormError(null);
    if (!staffId) return setFormError("Select an employee.");
    const res = await createEmployeeOnboardingRequest({ staffId, startDate });
    if (!res.success) return setFormError(res.error.message);
    resetForm();
    setCreateOpen(false);
    reload();
  }

  async function toggleTask(taskId: string, completed: boolean) {
    if (completed) await reopenOnboardingTaskRequest(taskId);
    else await completeOnboardingTaskRequest(taskId);
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Onboarding</h1>
          <p className="text-xs text-muted-foreground">New-joiner journeys and real checklist progress</p>
        </div>
        {canManage && <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="size-3.5" /> Start onboarding</Button>}
      </div>

      {error && (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load onboarding: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>Retry</Button>
        </div>
      )}

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
            placeholder="Search employee name or code…"
            aria-label="Search onboarding"
            className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as EmployeeOnboardingStatusDto | "all"); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(statusLabels) as EmployeeOnboardingStatusDto[]).map((s) => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading && onboardings.length === 0 ? (
        <p className="py-2xl text-center text-sm text-muted-foreground">Loading onboarding…</p>
      ) : onboardings.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <UserPlus className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {isFiltered ? "No onboarding records match your search or filters." : "No employees are currently onboarding."}
          </p>
          {!isFiltered && (
            <p className="text-xs text-muted-foreground">Start onboarding a SELECTED recruitment applicant from <Link href="/hr/recruitment" className="text-primary hover:underline">Recruitment</Link>, or use &ldquo;Start onboarding&rdquo; above.</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-md">
          {onboardings.map((ob) => (
            <div key={ob.id} className="rounded-lg border border-border bg-surface p-md">
              <div className="mb-sm flex items-center justify-between gap-sm">
                <Link href={`/hr/staff/${ob.staffId}`} className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground hover:underline">{ob.staffName} <span className="font-normal text-muted-foreground">· {ob.employeeCode}</span></p>
                  <p className="text-xs text-muted-foreground">Started {formatDate(ob.startDate)}{ob.hrOwnerName ? ` · Owner: ${ob.hrOwnerName}` : ""}</p>
                </Link>
                <div className="flex items-center gap-xs">
                  <Badge tone={statusTone[ob.status]}>{statusLabels[ob.status]}</Badge>
                  <Badge tone={ob.progressPercent === 100 ? "success" : ob.progressPercent >= 50 ? "info" : "warning"}>{ob.progressPercent}%</Badge>
                </div>
              </div>
              <div className="mb-sm h-1.5 w-full overflow-hidden rounded-pill bg-surface-secondary">
                <div className="h-full rounded-pill bg-primary transition-[width]" style={{ width: `${ob.progressPercent}%` }} />
              </div>
              <ol className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {ob.tasks.map((t) => {
                  const completed = t.status === "completed";
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        disabled={!canManage}
                        onClick={() => toggleTask(t.id, completed)}
                        className={`flex w-full items-center gap-2 rounded-md border p-sm text-left text-sm transition-colors ${completed ? "border-success/30 bg-success/8" : "border-border"} ${canManage ? "hover:border-primary/40" : "cursor-default"}`}
                      >
                        <span className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${completed ? "border-success bg-success text-white" : "border-border"}`}>{completed && <Check className="size-3" />}</span>
                        <span className={completed ? "text-muted-foreground line-through" : "text-foreground"}>{t.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}

      {meta && totalPages > 1 && (
        <div className="flex items-center justify-between gap-sm text-sm">
          <span className="text-muted-foreground">Page {meta.page} of {totalPages} · {meta.total} total</span>
          <div className="flex gap-xs">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="size-3.5" /> Prev
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {canManage && (
        <DetailDrawer open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }} title="Start onboarding" description="Start a real onboarding for an existing staff member">
          <div className="flex flex-col gap-sm">
            <div>
              <Label>Employee</Label>
              <Input value={staffSearch} onChange={(e) => setStaffSearch(e.target.value)} placeholder="Search staff by name or code…" className="mb-xs" />
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger aria-label="Employee"><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>{staffOptions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label htmlFor="ob-start">Start date</Label><Input id="ob-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            {formError && <p className="text-sm text-error">{formError}</p>}
            <Button disabled={!staffId} onClick={submit}>Start onboarding</Button>
          </div>
        </DetailDrawer>
      )}
    </div>
  );
}
