"use client";

// Real PostgreSQL/API cutover (Phase 9H). Lifecycle: DRAFT -> CALCULATED ->
// FINALIZED -> PAID (the mock's separate submit/approve gate is dropped —
// no real approval-workflow policy exists; see the schema doc comment for
// the full Payroll V1 policy). Calculate/recalculate never reads attendance
// or leave into the salary figures — those are informational-only columns.
import { useState } from "react";
import { AlertTriangle, Calculator, HandCoins, Lock, Plus, Wallet } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import {
  addManualPayrollAdjustmentRequest,
  calculatePayrollRunRequest,
  createPayrollRunRequest,
  finalizePayrollRunRequest,
  payPayrollRunRequest,
  useSalaryComponents,
  usePayrollRun,
  usePayrollRuns,
} from "@/lib/hooks/api/use-payroll-api";
import type { PayrollPaymentMethodDto, PayrollRunItemDto, PayrollRunStatusDto } from "@/lib/api/contracts";
import { roleLabels } from "@/lib/permissions/roles";
import { formatCurrency } from "@/lib/utils";

const statusTone: Record<PayrollRunStatusDto, "success" | "warning" | "error" | "neutral"> = { draft: "neutral", calculated: "warning", finalized: "neutral", paid: "success" };
const statusLabel: Record<PayrollRunStatusDto, string> = { draft: "Draft", calculated: "Calculated", finalized: "Finalized", paid: "Paid" };

function nextPeriod(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export default function PayrollRunPage() {
  const { data: runs, reload: reloadRuns } = usePayrollRuns();
  const { can, hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const canManage = can("payroll.manage");
  const canFinalize = can("payroll.finalize");
  const canPay = can("payroll.pay");

  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const runId = activeRunId ?? runs[0]?.id ?? null;
  const { data: run, reload: reloadRun } = usePayrollRun(runId);
  const { data: components } = useSalaryComponents({ status: "active" });

  const [createOpen, setCreateOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<PayrollRunItemDto | null>(null);
  const [period, setPeriod] = useState(nextPeriod());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!capabilitiesLoading && !hasServerPermission("payroll.view")) return <PermissionDenied action="view the payroll module" role={roleLabels[role]} backHref="/payroll" />;

  function reload() {
    reloadRuns();
    reloadRun();
  }

  const columns: ColumnDef<PayrollRunItemDto>[] = [
    { id: "staff", header: "Staff", alwaysVisible: true, cell: (i) => <div><p className="text-sm font-medium text-foreground">{i.staffName}</p><p className="text-xs text-muted-foreground">{i.employeeCode} · {i.salaryStructureName ?? "—"}</p></div> },
    { id: "attendance", header: "Attendance (info only)", cell: (i) => <span className="text-xs text-muted-foreground">P{i.attendance.present} A{i.attendance.absent} L{i.attendance.late} HD{i.attendance.halfDay} OL{i.attendance.onLeave} NM{i.attendance.notMarked}</span>, defaultVisible: false },
    { id: "gross", header: "Gross", align: "right", cell: (i) => <span className="text-sm text-foreground">{formatCurrency(i.grossEarnings)}</span> },
    { id: "deductions", header: "Deductions", align: "right", cell: (i) => <span className="text-sm text-foreground">{formatCurrency(i.totalDeductions)}</span> },
    { id: "net", header: "Net pay", align: "right", cell: (i) => <span className={`text-sm font-medium ${i.netPay < 0 ? "text-error" : "text-foreground"}`}>{formatCurrency(i.netPay)}</span> },
  ];
  const rowActions: RowAction<PayrollRunItemDto>[] = canManage
    ? [{ key: "adjust", label: "Add adjustment", icon: <Plus className="size-3.5" />, hidden: () => !run || run.status === "finalized" || run.status === "paid", onSelect: (i) => setAdjustItem(i) }]
    : [];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Run payroll</h1>
          <p className="text-xs text-muted-foreground">Calculate → finalize (immutable) → record payment (posts the accounting journal)</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => { setPeriod(nextPeriod()); setError(null); setCreateOpen(true); }}>
            <Plus className="size-3.5" />
            New run
          </Button>
        )}
      </div>

      {runs.length === 0 ? (
        <div className="flex flex-col items-center gap-xs rounded-lg border border-dashed border-border p-xl text-center">
          <HandCoins className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No payroll runs yet</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-xs">
            {runs.map((r) => (
              <button key={r.id} type="button" onClick={() => setActiveRunId(r.id)} className={`rounded-full border px-sm py-1 text-xs font-medium transition-colors ${runId === r.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                {r.period}
              </button>
            ))}
          </div>

          {run && (
            <div className="flex flex-col gap-sm">
              <div className="surface-3d flex flex-wrap items-center justify-between gap-sm rounded-lg border border-border bg-surface p-md">
                <div>
                  <div className="flex items-center gap-xs">
                    <p className="text-sm font-semibold text-foreground">{run.period}</p>
                    <Badge tone={statusTone[run.status]}>{statusLabel[run.status]}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{run.staffCount} staff · Gross {formatCurrency(run.totalGross)} · Net {formatCurrency(run.totalNet)}</p>
                  {run.staffWithoutAssignment.length > 0 && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-warning">
                      <AlertTriangle className="size-3" />
                      {run.staffWithoutAssignment.length} active staff have no salary assignment and are excluded
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-xs">
                  {canManage && (run.status === "draft" || run.status === "calculated") && (
                    <Button size="sm" disabled={busy} onClick={async () => { setBusy(true); const res = await calculatePayrollRunRequest(run.id); setBusy(false); if (!res.success) setError(res.error.message); else reload(); }}>
                      <Calculator className="size-3.5" />
                      {run.status === "draft" ? "Calculate" : "Recalculate"}
                    </Button>
                  )}
                  {canFinalize && run.status === "calculated" && (
                    <Button size="sm" disabled={busy} onClick={async () => { setBusy(true); const res = await finalizePayrollRunRequest(run.id); setBusy(false); if (!res.success) setError(res.error.message); else reload(); }}>
                      <Lock className="size-3.5" />
                      Finalize
                    </Button>
                  )}
                  {canPay && run.status === "finalized" && (
                    <Button size="sm" onClick={() => { setError(null); setPayOpen(true); }}>
                      <Wallet className="size-3.5" />
                      Record payment
                    </Button>
                  )}
                </div>
              </div>
              {error && <p className="text-xs text-error">{error}</p>}

              <DataTable
                columns={columns}
                rows={run.items}
                getRowId={(i) => i.id}
                caption={`Payroll — ${run.period}`}
                rowActions={rowActions}
                renderMobileCard={(i) => (
                  <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
                    <div className="flex items-center justify-between gap-xs">
                      <p className="truncate text-sm font-semibold text-foreground">{i.staffName}</p>
                      <span className={`text-sm font-medium ${i.netPay < 0 ? "text-error" : "text-foreground"}`}>{formatCurrency(i.netPay)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Gross {formatCurrency(i.grossEarnings)} · Deductions {formatCurrency(i.totalDeductions)}</p>
                  </div>
                )}
                emptyIcon={HandCoins}
                emptyTitle="No calculated staff yet — click Calculate"
              />
            </div>
          )}
        </>
      )}

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="New payroll run" description="Creates a draft for one month; calculate afterward to generate staff snapshots">
        <div className="flex flex-col gap-sm">
          {error && <p className="text-xs text-error">{error}</p>}
          <div className="grid grid-cols-2 gap-xs">
            <div>
              <Label htmlFor="run-year">Year</Label>
              <Input id="run-year" type="number" value={period.year} onChange={(e) => setPeriod((p) => ({ ...p, year: Number(e.target.value) }))} />
            </div>
            <div>
              <Label htmlFor="run-month">Month</Label>
              <Input id="run-month" type="number" min={1} max={12} value={period.month} onChange={(e) => setPeriod((p) => ({ ...p, month: Number(e.target.value) }))} />
            </div>
          </div>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true); setError(null);
              const res = await createPayrollRunRequest(period);
              setBusy(false);
              if (!res.success) { setError(res.error.message); return; }
              setActiveRunId(res.data.id);
              setCreateOpen(false);
              reloadRuns();
            }}
          >
            Create draft run
          </Button>
        </div>
      </DetailDrawer>

      <DetailDrawer open={payOpen} onOpenChange={setPayOpen} title="Record payroll payment" description="Records that the finalized total was paid — this does not initiate a real bank transfer">
        <PaymentForm
          amount={run?.totalNet ?? 0}
          onSubmit={async (method, paymentDate, reference) => {
            if (!run) return;
            setBusy(true); setError(null);
            const res = await payPayrollRunRequest(run.id, { method, paymentDate, reference });
            setBusy(false);
            if (!res.success) { setError(res.error.message); return; }
            setPayOpen(false);
            reload();
          }}
          busy={busy}
          error={error}
        />
      </DetailDrawer>

      <DetailDrawer open={Boolean(adjustItem)} onOpenChange={(o) => !o && setAdjustItem(null)} title="Add manual adjustment" description={adjustItem ? `${adjustItem.staffName} — ${run?.period}` : ""}>
        {adjustItem && run && (
          <AdjustmentForm
            components={components ?? []}
            onSubmit={async (componentId, amount, reason) => {
              setBusy(true); setError(null);
              const res = await addManualPayrollAdjustmentRequest(run.id, adjustItem.id, { componentId, amount, reason });
              setBusy(false);
              if (!res.success) { setError(res.error.message); return; }
              setAdjustItem(null);
              reload();
            }}
            busy={busy}
            error={error}
          />
        )}
      </DetailDrawer>
    </div>
  );
}

function PaymentForm({ amount, onSubmit, busy, error }: { amount: number; onSubmit: (method: PayrollPaymentMethodDto, paymentDate: string, reference?: string) => void; busy: boolean; error: string | null }) {
  const [method, setMethod] = useState<PayrollPaymentMethodDto>("bank_transfer");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  return (
    <div className="flex flex-col gap-sm">
      {error && <p className="text-xs text-error">{error}</p>}
      <p className="text-sm text-foreground">Total payable: <span className="font-semibold">{formatCurrency(amount)}</span></p>
      <div>
        <Label htmlFor="pay-date">Payment date</Label>
        <Input id="pay-date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
      </div>
      <div>
        <Label>Method</Label>
        <Select value={method} onValueChange={(v) => setMethod(v as PayrollPaymentMethodDto)}>
          <SelectTrigger aria-label="Method">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bank_transfer">Bank transfer</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="upi">UPI</SelectItem>
            <SelectItem value="cheque">Cheque</SelectItem>
            <SelectItem value="card">Card</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="pay-ref">Reference (optional)</Label>
        <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / cheque no." />
      </div>
      <Button disabled={busy} onClick={() => onSubmit(method, paymentDate, reference.trim() || undefined)}>
        Record payment
      </Button>
      <p className="text-[11px] text-muted-foreground">This records the payroll payment; it does not initiate a bank transfer.</p>
    </div>
  );
}

function AdjustmentForm({ components, onSubmit, busy, error }: { components: { id: string; name: string; type: string }[]; onSubmit: (componentId: string, amount: number, reason: string) => void; busy: boolean; error: string | null }) {
  const [componentId, setComponentId] = useState("");
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  return (
    <div className="flex flex-col gap-sm">
      {error && <p className="text-xs text-error">{error}</p>}
      <div>
        <Label>Component</Label>
        <Select value={componentId} onValueChange={setComponentId}>
          <SelectTrigger aria-label="Component">
            <SelectValue placeholder="Select component" />
          </SelectTrigger>
          <SelectContent>
            {components.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name} ({c.type === "earning" ? "Earning" : "Deduction"})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="adj-amount">Amount</Label>
        <Input id="adj-amount" type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
      </div>
      <div>
        <Label htmlFor="adj-reason">Reason</Label>
        <Input id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Diwali bonus" />
      </div>
      <Button disabled={busy || !componentId || amount <= 0 || !reason.trim()} onClick={() => onSubmit(componentId, amount, reason.trim())}>
        Add adjustment
      </Button>
    </div>
  );
}
