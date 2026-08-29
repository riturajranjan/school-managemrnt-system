"use client";

// Real PostgreSQL/API cutover (Phase 9F) — POSTs to /api/fees/adjustments
// (kind: "late_fee"). No automatic accrual scheduler exists in this repo, so
// late fees are applied explicitly (server-side, idempotent per apply — see
// the adjustments service doc comment), not silently compounded.
import { useState } from "react";
import { Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import { FeeTrail } from "@/components/fees/fee-trail";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useStudentList } from "@/lib/hooks/api/use-students";
import { applyFeeAdjustmentRequest, useFeeAdjustmentReport, useStudentFeeLedger } from "@/lib/hooks/api/use-fees-api";
import type { FeeAdjustmentAmountTypeDto } from "@/lib/api/contracts";
import { roleLabels } from "@/lib/permissions/roles";
import { formatCurrency } from "@/lib/utils";

export default function LateFeesPage() {
  const { can, hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const canManage = can("fees.manage");
  const { data: report } = useFeeAdjustmentReport("late_fee");

  const [search, setSearch] = useState("");
  const { data: students } = useStudentList({ search: search.trim() || undefined, pageSize: 10, status: ["active"] });
  const [studentId, setStudentId] = useState<string | null>(null);
  const { data: ledger, reload } = useStudentFeeLedger(studentId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [amountType, setAmountType] = useState<FeeAdjustmentAmountTypeDto>("fixed");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!capabilitiesLoading && !hasServerPermission("fees.view")) return <PermissionDenied action="view the fees module" role={roleLabels[role]} backHref="/fees" />;

  if (!canManage) {
    return (
      <div className="flex flex-col items-center gap-sm py-2xl text-center">
        <Scale className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">You don&apos;t have permission to manage late fee rules.</p>
      </div>
    );
  }

  const overdueCharges = (ledger?.charges ?? []).filter((c) => c.status === "overdue");

  async function apply() {
    setError(null);
    if (selected.size === 0) return setError("Select at least one overdue fee item.");
    if (!value || Number(value) <= 0) return setError("Enter a positive value.");
    if (!reason.trim()) return setError("A reason is required.");
    setSaving(true);
    for (const chargeId of selected) {
      const res = await applyFeeAdjustmentRequest({ chargeId, kind: "late_fee", amountType, value: Number(value), reason: reason.trim() });
      if (!res.success) {
        setError(res.error.message);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    setSelected(new Set());
    setValue("");
    setReason("");
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <FeeTrail items={[{ label: "Fees", href: "/fees" }, { label: "Fee Setup", href: "/fees/setup" }, { label: "Late Fee Rules" }]} />

      <div>
        <h1 className="text-lg font-semibold text-foreground">Late Fee Rules</h1>
        <p className="text-xs text-muted-foreground">Set extra charges for a student&apos;s overdue fees.</p>
      </div>

      {report && (
        <div className="grid grid-cols-2 gap-sm sm:grid-cols-2">
          <StatTile label="Total late fees applied" value={formatCurrency(report.totalLateFees)} tone="neutral" />
          <StatTile label="Applications count" value={String(report.count)} tone="neutral" />
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-md">
        <Label htmlFor="student-search">Student</Label>
        <Input id="student-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or admission number" />
        {search.trim() && !studentId && (
          <div className="mt-sm flex flex-col gap-1">
            {students.map((s) => (
              <button key={s.id} type="button" onClick={() => { setStudentId(s.id); setSearch(`${s.firstName} ${s.lastName}`); }} className="flex items-center justify-between rounded-md px-sm py-1.5 text-left text-sm hover:bg-surface-secondary/60">
                <span>{s.firstName} {s.lastName}</span>
                <span className="text-xs text-muted-foreground">{s.admissionNumber}</span>
              </button>
            ))}
          </div>
        )}

        {studentId && ledger && (
          <div className="mt-sm flex flex-col gap-sm">
            <div className="flex flex-col gap-1">
              {overdueCharges.map((c) => (
                <label key={c.id} className="flex items-center gap-sm rounded-md border border-border px-sm py-1.5 text-sm">
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => setSelected((prev) => { const next = new Set(prev); if (next.has(c.id)) next.delete(c.id); else next.add(c.id); return next; })} />
                  <span className="min-w-0 flex-1 truncate text-foreground">{c.itemName || c.categoryName}</span>
                  <span className="text-xs text-muted-foreground">{formatCurrency(c.balance)} overdue</span>
                </label>
              ))}
              {overdueCharges.length === 0 && <p className="text-sm text-muted-foreground">No overdue fee items for this student.</p>}
            </div>

            <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
              <Select value={amountType} onValueChange={(v) => setAmountType(v as FeeAdjustmentAmountTypeDto)}>
                <SelectTrigger aria-label="Type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed amount</SelectItem>
                  <SelectItem value="percentage">Percentage</SelectItem>
                </SelectContent>
              </Select>
              <Input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} placeholder={amountType === "percentage" ? "e.g. 5" : "e.g. 200"} />
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (e.g. Overdue 30+ days)" />
            </div>
            {error && <Badge tone="error">{error}</Badge>}
            <Button disabled={saving} onClick={apply} className="self-start">
              Apply late fee
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
