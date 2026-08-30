"use client";

// Contracts (Production migration, Phase B, HR Sub-batch 2) — real
// PostgreSQL/API cutover. Real Staff relationship, hr.view/hr.manage RBAC
// (no new permission — the existing HR catalog already expresses this).
// compensationNote is confidential and is only ever populated for a caller
// holding hr.view/hr.manage (see lib/server/hr/contracts.ts) — never shown
// merely because of hr.viewOwn.
import { useState } from "react";
import { AlertTriangle, FileText, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { createContractRequest, setContractStatusRequest, useContracts } from "@/lib/hooks/api/use-hr-api";
import { useStaffList } from "@/lib/hooks/api/use-staff-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { ContractDto, ContractStatusDto, ContractTypeDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const typeLabels: Record<ContractTypeDto, string> = {
  permanent: "Permanent",
  "fixed-term": "Fixed term",
  probation: "Probation",
  temporary: "Temporary",
  "part-time": "Part time",
  consultant: "Consultant",
  "visiting-faculty": "Visiting faculty",
};

const statusLabels: Record<ContractStatusDto, string> = {
  draft: "Draft",
  active: "Active",
  "renewal-pending": "Renewal pending",
  expired: "Expired",
  terminated: "Terminated",
  archived: "Archived",
};

const statusTone: Record<ContractStatusDto, "success" | "warning" | "error" | "neutral" | "info"> = {
  draft: "neutral",
  active: "success",
  "renewal-pending": "warning",
  expired: "error",
  terminated: "neutral",
  archived: "neutral",
};

const NEXT_STATUS: Record<ContractStatusDto, ContractStatusDto[]> = {
  draft: ["active", "archived"],
  active: ["renewal-pending", "terminated", "expired"],
  "renewal-pending": ["active", "terminated", "expired"],
  expired: ["archived"],
  terminated: ["archived"],
  archived: [],
};

export default function ContractsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: contracts, loading, error, reload } = useContracts();
  const { data: staff } = useStaffList({ status: "active", pageSize: 500 });
  const [filter, setFilter] = useState<"attention" | "all">("attention");
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Form state
  const [staffId, setStaffId] = useState("");
  const [type, setType] = useState<ContractTypeDto>("permanent");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [noticePeriodDays, setNoticePeriodDays] = useState("");
  const [workHoursPerWeek, setWorkHoursPerWeek] = useState("");
  const [probationMonths, setProbationMonths] = useState("");
  const [compensationNote, setCompensationNote] = useState("");
  const [terms, setTerms] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  if (!capabilitiesLoading && !hasServerPermission("hr.view") && !hasServerPermission("hr.manage")) {
    return <PermissionDenied action="view contracts" role={roleLabels[role]} backHref="/hr" />;
  }
  const canManage = hasServerPermission("hr.manage");

  const attention = contracts.filter((c) => c.status === "renewal-pending" || c.status === "expired" || c.isExpiringSoon);
  const rows = filter === "attention" ? attention : contracts;

  function resetForm() {
    setStaffId(""); setType("permanent"); setStartDate(""); setEndDate("");
    setNoticePeriodDays(""); setWorkHoursPerWeek(""); setProbationMonths("");
    setCompensationNote(""); setTerms(""); setFormError(null);
  }

  async function submit() {
    setFormError(null);
    if (!staffId || !startDate) return setFormError("Employee and start date are required.");
    const res = await createContractRequest({
      staffId, type, startDate, endDate: endDate || undefined,
      noticePeriodDays: noticePeriodDays ? Number(noticePeriodDays) : undefined,
      workHoursPerWeek: workHoursPerWeek ? Number(workHoursPerWeek) : undefined,
      probationMonths: probationMonths ? Number(probationMonths) : undefined,
      compensationNote: compensationNote.trim() || undefined,
      terms: terms.trim() || undefined,
    });
    if (!res.success) return setFormError(res.error.message);
    resetForm();
    setCreateOpen(false);
    reload();
  }

  async function transition(contract: ContractDto, status: ContractStatusDto) {
    setBusyId(contract.id);
    await setContractStatusRequest(contract.id, status);
    setBusyId(null);
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Contracts</h1>
          <p className="text-xs text-muted-foreground">{attention.length} contract(s) need attention</p>
        </div>
        <div className="flex items-center gap-xs">
          <div className="inline-flex rounded-md border border-border p-0.5">
            {(["attention", "all"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`rounded px-sm py-1.5 text-xs font-medium capitalize ${filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{f}</button>
            ))}
          </div>
          {canManage && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" /> Add contract
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load contracts: {error}
        </div>
      )}

      {attention.length > 0 && filter === "attention" && !error && (
        <div className="flex items-center gap-sm rounded-md border border-warning/30 bg-warning/8 p-sm text-sm text-warning">
          <AlertTriangle className="size-4" /> {attention.length} contract(s) expiring soon or awaiting renewal — review.
        </div>
      )}

      {loading && contracts.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-2xl text-center text-sm text-muted-foreground">Loading contracts…</div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <FileText className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No contracts found.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {rows.map((c) => (
            <div key={c.id} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{c.staffName} <span className="font-normal text-muted-foreground">· {c.employeeCode}</span></p>
                <p className="truncate text-xs text-muted-foreground">
                  {typeLabels[c.type]} · {formatDate(c.startDate)} – {c.endDate ? formatDate(c.endDate) : "no end date"}
                  {c.compensationNote ? ` · ${c.compensationNote}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-xs">
                {c.isExpiringSoon && c.status !== "expired" && <Badge tone="warning">Expiring soon</Badge>}
                <Badge tone={statusTone[c.status]}>{statusLabels[c.status]}</Badge>
                {canManage && NEXT_STATUS[c.status].length > 0 && (
                  <Select value="" onValueChange={(v) => transition(c, v as ContractStatusDto)}>
                    <SelectTrigger className="h-8 w-auto text-xs" disabled={busyId === c.id} aria-label="Change status">
                      <SelectValue placeholder="Change status" />
                    </SelectTrigger>
                    <SelectContent>
                      {NEXT_STATUS[c.status].map((s) => (
                        <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <DetailDrawer open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }} title="Add contract" description="Create a real employment contract">
          <div className="flex flex-col gap-sm">
            <div>
              <Label>Employee</Label>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger aria-label="Employee"><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contract type</Label>
              <Select value={type} onValueChange={(v) => setType(v as ContractTypeDto)}>
                <SelectTrigger aria-label="Contract type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(typeLabels) as ContractTypeDto[]).map((t) => <SelectItem key={t} value={t}>{typeLabels[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-sm">
              <div>
                <Label htmlFor="contract-start">Start date</Label>
                <Input id="contract-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="contract-end">End date (optional)</Label>
                <Input id="contract-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-sm">
              <div>
                <Label htmlFor="contract-probation">Probation (months)</Label>
                <Input id="contract-probation" type="number" min={0} value={probationMonths} onChange={(e) => setProbationMonths(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="contract-notice">Notice (days)</Label>
                <Input id="contract-notice" type="number" min={0} value={noticePeriodDays} onChange={(e) => setNoticePeriodDays(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="contract-hours">Hours/week</Label>
                <Input id="contract-hours" type="number" min={1} value={workHoursPerWeek} onChange={(e) => setWorkHoursPerWeek(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="contract-comp">Compensation note (confidential)</Label>
              <Textarea id="contract-comp" value={compensationNote} onChange={(e) => setCompensationNote(e.target.value)} placeholder="Never shown to the employee via self-service" />
            </div>
            <div>
              <Label htmlFor="contract-terms">Terms</Label>
              <Textarea id="contract-terms" value={terms} onChange={(e) => setTerms(e.target.value)} />
            </div>
            {formError && <p className="text-sm text-error">{formError}</p>}
            <Button onClick={submit}>Create contract</Button>
          </div>
        </DetailDrawer>
      )}
    </div>
  );
}
