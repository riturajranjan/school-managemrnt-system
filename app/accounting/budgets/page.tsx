"use client";

// Real PostgreSQL/API cutover (Production Accounting checkpoint) — reads/
// writes the live /api/accounting/budgets endpoint. BUDGETED is the only
// figure this page ever submits; ACTUAL/variance are always computed
// server-side from POSTED JournalLines against the real Chart of Accounts
// (lib/server/accounting/budgets.ts) — never recomputed here, never sourced
// from a PurchaseOrder.
import { useState } from "react";
import { AlertTriangle, Check, PiggyBank, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { approveBudgetRequest, createBudgetRequest, useAccountingAccounts, useBudget, useBudgets } from "@/lib/hooks/api/use-accounting-api";
import { roleLabels } from "@/lib/permissions/roles";
import { formatCurrency } from "@/lib/utils";

type AllocationDraft = { accountingAccountId: string; amount: number };
function blankAllocation(): AllocationDraft {
  return { accountingAccountId: "", amount: 0 };
}
function utilizationPercent(actual: number, budgeted: number): number {
  if (budgeted === 0) return actual === 0 ? 0 : 100;
  return Math.round((actual / budgeted) * 100);
}

export default function BudgetsPage() {
  const { data: budgets, loading, error, reload } = useBudgets({ pageSize: 100 });
  const { data: accounts } = useAccountingAccounts({ status: "active" });
  const { can, hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const canManage = can("accounting.manage");

  const [detailId, setDetailId] = useState<string | null>(null);
  const { data: detail, reload: reloadDetail } = useBudget(detailId);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [periodStart, setPeriodStart] = useState(new Date().toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10));
  const [allocations, setAllocations] = useState<AllocationDraft[]>([blankAllocation()]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!capabilitiesLoading && !hasServerPermission("accounting.view")) return <PermissionDenied action="view the accounting module" role={roleLabels[role]} backHref="/accounting" />;

  function resetForm() {
    setName(""); setAllocations([blankAllocation()]); setFormError(null);
  }
  function updateAllocation(index: number, patch: Partial<AllocationDraft>) {
    setAllocations((current) => current.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Budgets</h1>
          <p className="text-xs text-muted-foreground">Planned allocations against the Chart of Accounts, tracked live against posted journals</p>
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
          >
            <Plus className="size-3.5" />
            New budget
          </Button>
        )}
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}
      {loading && budgets.length === 0 && <p className="text-xs text-muted-foreground">Loading…</p>}

      {!loading && budgets.length === 0 ? (
        <div className="flex flex-col items-center gap-xs rounded-lg border border-dashed border-border p-xl text-center">
          <PiggyBank className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No budgets yet</p>
          <p className="text-xs text-muted-foreground">Create a budget to track planned vs actual spend by account.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          {budgets.map((budget) => {
            const pct = utilizationPercent(budget.totalActual, budget.totalBudgeted);
            return (
              <button key={budget.id} type="button" onClick={() => setDetailId(budget.id)} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="flex items-center justify-between gap-xs">
                  <p className="text-sm font-semibold text-foreground">{budget.name}</p>
                  <Badge tone={budget.status === "approved" ? "success" : "warning"}>{budget.status === "approved" ? "Approved" : "Draft"}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {budget.periodStart} – {budget.periodEnd}
                </p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-secondary">
                  <div className={`h-full rounded-full ${pct >= 100 ? "bg-error" : pct >= 85 ? "bg-warning" : "bg-success"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatCurrency(budget.totalActual)} spent</span>
                  <span>{formatCurrency(budget.totalBudgeted)} planned</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <DetailDrawer open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)} title={detail?.name ?? ""} description={detail ? `${detail.periodStart} – ${detail.periodEnd} · ${detail.status === "approved" ? "Approved" : "Draft"}` : undefined}>
        {detail && (
          <div className="flex flex-col gap-sm">
            {canManage && detail.status === "draft" && (
              <Button
                size="sm"
                onClick={() =>
                  approveBudgetRequest(detail.id).then(() => {
                    reload();
                    reloadDetail();
                  })
                }
              >
                <Check className="size-3.5" />
                Approve budget
              </Button>
            )}
            <div className="flex flex-col gap-xs">
              {detail.allocations.map((line) => {
                const pct = utilizationPercent(line.actual, line.budgeted);
                const over = pct >= 85;
                return (
                  <div key={line.id} className="rounded-lg border border-border p-sm">
                    <div className="flex items-center justify-between gap-xs">
                      <p className="text-sm font-medium text-foreground">{line.accountName} <span className="text-xs text-muted-foreground">({line.accountCode})</span></p>
                      {over && <AlertTriangle className="size-3.5 text-warning" />}
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-secondary">
                      <div className={`h-full rounded-full ${pct >= 100 ? "bg-error" : over ? "bg-warning" : "bg-success"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {formatCurrency(line.actual)} of {formatCurrency(line.budgeted)}
                      </span>
                      <span>{pct}% · variance {formatCurrency(line.variance)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DetailDrawer>

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="New budget" description="Draft budget requiring approval before it becomes active">
        <div className="flex flex-col gap-sm">
          {formError && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{formError}</p>}
          <div>
            <Label htmlFor="budget-name">Budget name</Label>
            <Input id="budget-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 2026-2027 Operating Budget" />
          </div>
          <div className="grid grid-cols-2 gap-sm">
            <div>
              <Label htmlFor="budget-start">Period start</Label>
              <Input id="budget-start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="budget-end">Period end</Label>
              <Input id="budget-end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-xs">
            <Label>Account allocations</Label>
            {allocations.map((line, i) => (
              <div key={i} className="flex items-end gap-xs">
                <div className="min-w-0 flex-1">
                  <Select value={line.accountingAccountId} onValueChange={(v) => updateAllocation(i, { accountingAccountId: v })}>
                    <SelectTrigger aria-label={`Line ${i + 1} account`}>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} ({a.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-28">
                  <Input type="number" min={0} value={line.amount} onChange={(e) => updateAllocation(i, { amount: Number(e.target.value) })} placeholder="Amount ₹" />
                </div>
                <Button variant="ghost" size="icon" disabled={allocations.length <= 1} onClick={() => setAllocations((current) => current.filter((_, idx) => idx !== i))} aria-label={`Remove line ${i + 1}`}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={() => setAllocations((current) => [...current, blankAllocation()])}>
              <Plus className="size-3.5" />
              Add account
            </Button>
          </div>

          <Button
            disabled={!name.trim() || allocations.some((a) => !a.accountingAccountId || a.amount <= 0) || saving}
            onClick={async () => {
              setFormError(null);
              setSaving(true);
              const res = await createBudgetRequest({ name: name.trim(), periodStart, periodEnd, allocations });
              setSaving(false);
              if (!res.success) {
                setFormError(res.error.message);
                return;
              }
              setCreateOpen(false);
              resetForm();
              reload();
            }}
          >
            Create budget
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
