"use client";

import { useState } from "react";
import { AlertTriangle, Check, HandCoins, Lock, Plus, Send, Wallet, X } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/components/providers/permissions-provider";
import { usePayrollRuns } from "@/lib/hooks/use-finance";
import { formatMoney } from "@/lib/finance/money";
import { approvePayrollRun, cancelPayrollRun, createPayrollRun, lockPayrollRun, markPayrollPaid, submitPayrollForReview, updateEmployeeAttendance } from "@/lib/services/payroll-run-service";
import { payrollEmployeeExceptionLabels, payrollRunStatusLabels, type PayrollEmployeeLine, type PayrollRunStatus } from "@/lib/types/payroll";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };

const statusTone: Record<PayrollRunStatus, "success" | "warning" | "error" | "neutral"> = {
  draft: "neutral",
  calculating: "warning",
  review: "warning",
  approved: "neutral",
  locked: "neutral",
  paid: "success",
  "partially-paid": "warning",
  cancelled: "error",
};

function nextPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function PayrollRunPage() {
  const runs = usePayrollRuns();
  const { can } = usePermissions();
  const canRun = can("payroll.run");
  const canApprove = can("payroll.approve");

  const [createOpen, setCreateOpen] = useState(false);
  const [period, setPeriod] = useState(nextPeriod());
  const [error, setError] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(runs[0]?.id ?? null);

  const activeRun = runs.find((r) => r.id === activeRunId) ?? [...runs].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];

  const columns: ColumnDef<PayrollEmployeeLine>[] = [
    {
      id: "employee",
      header: "Employee",
      alwaysVisible: true,
      cell: (e) => (
        <div>
          <p className="text-sm font-medium text-foreground">{e.employeeName}</p>
          {e.exceptions.length > 0 && (
            <p className="flex items-center gap-1 text-xs text-error">
              <AlertTriangle className="size-3" />
              {e.exceptions.map((ex) => payrollEmployeeExceptionLabels[ex]).join(", ")}
            </p>
          )}
        </div>
      ),
    },
    {
      id: "attendance",
      header: "Attendance",
      cell: (e) =>
        activeRun?.status === "draft" && canRun ? (
          <Input
            type="number"
            min={0}
            max={e.workingDays}
            defaultValue={e.attendanceDays}
            className="h-8 w-20"
            onBlur={(ev) => {
              const value = Number(ev.target.value);
              if (activeRun && !Number.isNaN(value)) updateEmployeeAttendance(activeRun.id, e.employeeId, value, ACTOR);
            }}
          />
        ) : (
          <span className="text-sm text-muted-foreground">
            {e.attendanceDays}/{e.workingDays}
          </span>
        ),
    },
    { id: "gross", header: "Gross", align: "right", cell: (e) => <span className="text-sm text-foreground">{formatMoney(e.grossPay)}</span> },
    { id: "deductions", header: "Deductions", align: "right", cell: (e) => <span className="text-sm text-foreground">{formatMoney(e.totalDeductions)}</span> },
    { id: "net", header: "Net pay", align: "right", cell: (e) => <span className={`text-sm font-medium ${e.netPay.minorUnits < 0 ? "text-error" : "text-foreground"}`}>{formatMoney(e.netPay)}</span> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Run payroll</h1>
          <p className="text-xs text-muted-foreground">Draft → review → approve → lock (posts journal + payslips) → paid</p>
        </div>
        {canRun && (
          <Button
            size="sm"
            onClick={() => {
              setPeriod(nextPeriod());
              setError(null);
              setCreateOpen(true);
            }}
          >
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
            {[...runs]
              .sort((a, b) => (a.period < b.period ? 1 : -1))
              .map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => setActiveRunId(run.id)}
                  className={`rounded-full border px-sm py-1 text-xs font-medium transition-colors ${activeRun?.id === run.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                >
                  {run.period}
                </button>
              ))}
          </div>

          {activeRun && (
            <div className="flex flex-col gap-sm">
              <div className="surface-3d flex flex-wrap items-center justify-between gap-sm rounded-lg border border-border bg-surface p-md">
                <div>
                  <div className="flex items-center gap-xs">
                    <p className="text-sm font-semibold text-foreground">{activeRun.period}</p>
                    <Badge tone={statusTone[activeRun.status]}>{payrollRunStatusLabels[activeRun.status]}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {activeRun.employees.length} employee(s) · Gross {formatMoney(activeRun.totalGross)} · Net {formatMoney(activeRun.totalNet)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-xs">
                  {canRun && activeRun.status === "draft" && (
                    <Button size="sm" onClick={() => submitPayrollForReview(activeRun.id, ACTOR)}>
                      <Send className="size-3.5" />
                      Submit for review
                    </Button>
                  )}
                  {canRun && (activeRun.status === "draft" || activeRun.status === "review") && (
                    <Button size="sm" variant="ghost" onClick={() => cancelPayrollRun(activeRun.id, "Cancelled by finance", ACTOR)}>
                      <X className="size-3.5" />
                      Cancel
                    </Button>
                  )}
                  {canApprove && activeRun.status === "review" && (
                    <Button size="sm" onClick={() => approvePayrollRun(activeRun.id, ACTOR)}>
                      <Check className="size-3.5" />
                      Approve
                    </Button>
                  )}
                  {canApprove && activeRun.status === "approved" && (
                    <Button size="sm" onClick={() => lockPayrollRun(activeRun.id, ACTOR)}>
                      <Lock className="size-3.5" />
                      Lock & post journal
                    </Button>
                  )}
                  {canRun && activeRun.status === "locked" && (
                    <Button size="sm" onClick={() => markPayrollPaid(activeRun.id, ACTOR)}>
                      <Wallet className="size-3.5" />
                      Mark paid
                    </Button>
                  )}
                </div>
              </div>

              <DataTable
                columns={columns}
                rows={activeRun.employees}
                getRowId={(e) => e.id}
                caption={`Payroll — ${activeRun.period}`}
                renderMobileCard={(e) => (
                  <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
                    <div className="flex items-center justify-between gap-xs">
                      <p className="truncate text-sm font-semibold text-foreground">{e.employeeName}</p>
                      <span className={`text-sm font-medium ${e.netPay.minorUnits < 0 ? "text-error" : "text-foreground"}`}>{formatMoney(e.netPay)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Gross {formatMoney(e.grossPay)} · Attendance {e.attendanceDays}/{e.workingDays}
                    </p>
                  </div>
                )}
                emptyIcon={HandCoins}
                emptyTitle="No employees in this run"
              />
            </div>
          )}
        </>
      )}

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="New payroll run" description="Calculates gross/net pay for every active salary structure">
        <div className="flex flex-col gap-sm">
          {error && <p className="text-xs text-error">{error}</p>}
          <div>
            <Label htmlFor="run-period">Period (YYYY-MM)</Label>
            <Input id="run-period" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-09" />
          </div>
          <Button
            onClick={() => {
              const result = createPayrollRun(period, "main", ACTOR);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setActiveRunId(result.run.id);
              setCreateOpen(false);
            }}
          >
            Calculate payroll
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
