"use client";

// Real PostgreSQL/API cutover (Production Payroll checkpoint) — reads/writes
// the live /api/payroll/loans endpoint. Principal only: no interest, no EMI/
// installment-schedule engine, no automatic eligibility scoring, no
// automatic payroll-deduction recovery. Disbursement/repayment are recording
// only (never a real bank transfer) and post to the real Phase 9G ledger —
// creating or approving a loan never does. Outstanding is always server-
// derived, never entered by hand. Lifecycle UI lives in the shared
// components/payroll/loan-advance-detail.tsx (identical for /payroll/advances).
import { useState } from "react";
import { Banknote, ClipboardList, Plus } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoanAdvanceDetail, statusLabels, statusTone, useLoanAdvanceActionState } from "@/components/payroll/loan-advance-detail";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useStaffList } from "@/lib/hooks/api/use-staff-api";
import { approveLoanRequest, cancelLoanRequest, createLoanRequest, disburseLoanRequest, rejectLoanRequest, repayLoanRequest, useLoan, useLoans } from "@/lib/hooks/api/use-payroll-api";
import type { StaffFinancialAdvanceListItemDto } from "@/lib/api/contracts";
import { roleLabels } from "@/lib/permissions/roles";
import { formatCurrency } from "@/lib/utils";

export default function PayrollLoansPage() {
  const { data: loans, loading, error, reload } = useLoans({ pageSize: 100 });
  const { data: staff } = useStaffList({ status: "active", pageSize: 200 });
  const { can, hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const canManage = can("payroll.manage");
  const canFinalize = can("payroll.finalize");
  const canPay = can("payroll.pay");

  const [detailId, setDetailId] = useState<string | null>(null);
  const { data: detail, reload: reloadDetail } = useLoan(detailId);
  const actionState = useLoanAdvanceActionState();

  const [createOpen, setCreateOpen] = useState(false);
  const [staffId, setStaffId] = useState("");
  const [principalAmount, setPrincipalAmount] = useState(0);
  const [purpose, setPurpose] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!capabilitiesLoading && !hasServerPermission("payroll.view")) return <PermissionDenied action="view the payroll module" role={roleLabels[role]} backHref="/payroll" />;

  function resetCreateForm() {
    setStaffId(""); setPrincipalAmount(0); setPurpose(""); setFormError(null);
  }
  function openDetail(l: StaffFinancialAdvanceListItemDto) {
    setDetailId(l.id);
    actionState.reset(l.outstanding);
  }
  function refreshAfterAction() {
    reload();
    reloadDetail();
  }

  const columns: ColumnDef<StaffFinancialAdvanceListItemDto>[] = [
    {
      id: "number", header: "Loan", alwaysVisible: true, sortValue: (l) => l.number,
      cell: (l) => (
        <div>
          <p className="text-sm font-medium text-foreground">{l.number}</p>
          <p className="text-xs text-muted-foreground">{l.staffName} ({l.employeeCode})</p>
        </div>
      ),
    },
    { id: "principal", header: "Principal", align: "right", sortValue: (l) => l.principalAmount, cell: (l) => <span className="text-sm text-foreground">{formatCurrency(l.principalAmount)}</span> },
    { id: "outstanding", header: "Outstanding", align: "right", sortValue: (l) => l.outstanding, cell: (l) => <span className="text-sm font-medium text-foreground">{formatCurrency(l.outstanding)}</span> },
    { id: "status", header: "Status", align: "right", cell: (l) => <Badge tone={statusTone[l.status]}>{statusLabels[l.status]}</Badge> },
  ];

  const rowActions: RowAction<StaffFinancialAdvanceListItemDto>[] = [{ key: "view", label: "View details", icon: <ClipboardList className="size-3.5" />, onSelect: (l) => openDetail(l) }];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Staff loans</h1>
          <p className="text-xs text-muted-foreground">Principal only — no interest, EMI schedule, or automatic payroll recovery</p>
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={() => {
              resetCreateForm();
              setCreateOpen(true);
            }}
          >
            <Plus className="size-3.5" />
            Request loan
          </Button>
        )}
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}
      {loading && loans.length === 0 && <p className="text-xs text-muted-foreground">Loading…</p>}

      <DataTable
        columns={columns}
        rows={loans}
        getRowId={(l) => l.id}
        caption="Staff loans"
        rowActions={rowActions}
        renderMobileCard={(l) => (
          <button type="button" onClick={() => openDetail(l)} className="surface-3d flex w-full flex-col gap-1 rounded-lg border border-border bg-surface p-sm text-left">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{l.number}</p>
              <Badge tone={statusTone[l.status]}>{statusLabels[l.status]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{l.staffName} ({l.employeeCode})</p>
            <p className="text-sm font-medium text-foreground">{formatCurrency(l.outstanding)} outstanding</p>
          </button>
        )}
        emptyIcon={Banknote}
        emptyTitle="No loans yet"
      />

      <DetailDrawer open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)} title={detail?.number ?? ""} description={detail ? `${detail.staffName} (${detail.employeeCode})` : undefined}>
        {detail && (
          <LoanAdvanceDetail
            detail={detail}
            kind="loan"
            canFinalize={canFinalize}
            canPay={canPay}
            canManage={canManage}
            state={actionState}
            onApprove={approveLoanRequest}
            onReject={rejectLoanRequest}
            onCancel={cancelLoanRequest}
            onDisburse={disburseLoanRequest}
            onRepay={repayLoanRequest}
            onRefresh={refreshAfterAction}
          />
        )}
      </DetailDrawer>

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="Request loan" description="Created as a pending request — a payroll manager must approve it">
        <div className="flex flex-col gap-sm">
          {formError && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{formError}</p>}
          <div>
            <Label>Staff member</Label>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger aria-label="Staff member">
                <SelectValue placeholder="Select staff" />
              </SelectTrigger>
              <SelectContent>
                {staff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.employeeCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="loan-principal">Principal amount (₹)</Label>
            <Input id="loan-principal" type="number" min={1} value={principalAmount} onChange={(e) => setPrincipalAmount(Number(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="loan-purpose">Purpose (optional)</Label>
            <Input id="loan-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Medical expense" />
          </div>
          <Button
            disabled={!staffId || principalAmount <= 0 || saving}
            onClick={async () => {
              setFormError(null);
              setSaving(true);
              const res = await createLoanRequest({ staffId, principalAmount, purpose: purpose.trim() || undefined });
              setSaving(false);
              if (!res.success) {
                setFormError(res.error.message);
                return;
              }
              setCreateOpen(false);
              resetCreateForm();
              reload();
            }}
          >
            Request loan
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
