"use client";

// Real PostgreSQL/API cutover (Production Payroll checkpoint) — reads/writes
// the live /api/payroll/advances endpoint. Same real StaffFinancialAdvance
// domain as /payroll/loans (type ADVANCE) — see that page's top comment and
// the shared components/payroll/loan-advance-detail.tsx for the full policy.
import { useState } from "react";
import { ClipboardList, Plus, Receipt } from "lucide-react";
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
import { approveAdvanceRequest, cancelAdvanceRequest, createAdvanceRequest, disburseAdvanceRequest, rejectAdvanceRequest, repayAdvanceRequest, useAdvance, useAdvances } from "@/lib/hooks/api/use-payroll-api";
import type { StaffFinancialAdvanceListItemDto } from "@/lib/api/contracts";
import { roleLabels } from "@/lib/permissions/roles";
import { formatCurrency } from "@/lib/utils";

export default function PayrollAdvancesPage() {
  const { data: advances, loading, error, reload } = useAdvances({ pageSize: 100 });
  const { data: staff } = useStaffList({ status: "active", pageSize: 200 });
  const { can, hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const canManage = can("payroll.manage");
  const canFinalize = can("payroll.finalize");
  const canPay = can("payroll.pay");

  const [detailId, setDetailId] = useState<string | null>(null);
  const { data: detail, reload: reloadDetail } = useAdvance(detailId);
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
  function openDetail(a: StaffFinancialAdvanceListItemDto) {
    setDetailId(a.id);
    actionState.reset(a.outstanding);
  }
  function refreshAfterAction() {
    reload();
    reloadDetail();
  }

  const columns: ColumnDef<StaffFinancialAdvanceListItemDto>[] = [
    {
      id: "number", header: "Advance", alwaysVisible: true, sortValue: (a) => a.number,
      cell: (a) => (
        <div>
          <p className="text-sm font-medium text-foreground">{a.number}</p>
          <p className="text-xs text-muted-foreground">{a.staffName} ({a.employeeCode})</p>
        </div>
      ),
    },
    { id: "principal", header: "Principal", align: "right", sortValue: (a) => a.principalAmount, cell: (a) => <span className="text-sm text-foreground">{formatCurrency(a.principalAmount)}</span> },
    { id: "outstanding", header: "Outstanding", align: "right", sortValue: (a) => a.outstanding, cell: (a) => <span className="text-sm font-medium text-foreground">{formatCurrency(a.outstanding)}</span> },
    { id: "status", header: "Status", align: "right", cell: (a) => <Badge tone={statusTone[a.status]}>{statusLabels[a.status]}</Badge> },
  ];

  const rowActions: RowAction<StaffFinancialAdvanceListItemDto>[] = [{ key: "view", label: "View details", icon: <ClipboardList className="size-3.5" />, onSelect: (a) => openDetail(a) }];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Staff advances</h1>
          <p className="text-xs text-muted-foreground">Single-amount salary advances — no wallet, no automatic payroll recovery</p>
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
            Request advance
          </Button>
        )}
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}
      {loading && advances.length === 0 && <p className="text-xs text-muted-foreground">Loading…</p>}

      <DataTable
        columns={columns}
        rows={advances}
        getRowId={(a) => a.id}
        caption="Staff advances"
        rowActions={rowActions}
        renderMobileCard={(a) => (
          <button type="button" onClick={() => openDetail(a)} className="surface-3d flex w-full flex-col gap-1 rounded-lg border border-border bg-surface p-sm text-left">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{a.number}</p>
              <Badge tone={statusTone[a.status]}>{statusLabels[a.status]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{a.staffName} ({a.employeeCode})</p>
            <p className="text-sm font-medium text-foreground">{formatCurrency(a.outstanding)} outstanding</p>
          </button>
        )}
        emptyIcon={Receipt}
        emptyTitle="No advances yet"
      />

      <DetailDrawer open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)} title={detail?.number ?? ""} description={detail ? `${detail.staffName} (${detail.employeeCode})` : undefined}>
        {detail && (
          <LoanAdvanceDetail
            detail={detail}
            kind="advance"
            canFinalize={canFinalize}
            canPay={canPay}
            canManage={canManage}
            state={actionState}
            onApprove={approveAdvanceRequest}
            onReject={rejectAdvanceRequest}
            onCancel={cancelAdvanceRequest}
            onDisburse={disburseAdvanceRequest}
            onRepay={repayAdvanceRequest}
            onRefresh={refreshAfterAction}
          />
        )}
      </DetailDrawer>

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="Request advance" description="Created as a pending request — a payroll manager must approve it">
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
            <Label htmlFor="advance-principal">Amount (₹)</Label>
            <Input id="advance-principal" type="number" min={1} value={principalAmount} onChange={(e) => setPrincipalAmount(Number(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="advance-purpose">Purpose (optional)</Label>
            <Input id="advance-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Salary advance" />
          </div>
          <Button
            disabled={!staffId || principalAmount <= 0 || saving}
            onClick={async () => {
              setFormError(null);
              setSaving(true);
              const res = await createAdvanceRequest({ staffId, principalAmount, purpose: purpose.trim() || undefined });
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
            Request advance
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
