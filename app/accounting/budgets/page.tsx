"use client";

import { useState } from "react";
import { AlertTriangle, Check, PiggyBank, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { formatMoney, moneyFromMajor } from "@/lib/finance/money";
import { actualForLine, totalActual, totalPlanned, utilizationPercent } from "@/lib/selectors/budget-insights";
import { approveBudget, createBudget, type BudgetLineDraft } from "@/lib/services/budget-service";
import { budgetStatusLabels, expenseCategoryLabels, type Budget, type ExpenseCategory } from "@/lib/types/accounting";
import { CURRENT_SESSION } from "@/lib/data/seed/reference";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };
const categoryOptions = Object.keys(expenseCategoryLabels) as ExpenseCategory[];

function blankLine(): BudgetLineDraft {
  return { category: "technology", plannedAmount: moneyFromMajor(0, "INR"), alertThresholdPercent: 85 };
}

export default function BudgetsPage() {
  const db = useSisStore();
  const { can } = usePermissions();
  const canManage = can("accounting.manageBudgets");
  const canApprove = can("accounting.approveBudgets");

  const [detail, setDetail] = useState<Budget | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [financialYear, setFinancialYear] = useState("2026-2027");
  const [lines, setLines] = useState<BudgetLineDraft[]>([blankLine()]);

  const budgets = [...db.budgets].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  function updateLine(index: number, patch: Partial<BudgetLineDraft>) {
    setLines((current) => current.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Budgets</h1>
          <p className="text-xs text-muted-foreground">Planned vs actual spend by category, tracked live against posted expenses</p>
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={() => {
              setName("");
              setLines([blankLine()]);
              setCreateOpen(true);
            }}
          >
            <Plus className="size-3.5" />
            New budget
          </Button>
        )}
      </div>

      {budgets.length === 0 ? (
        <div className="flex flex-col items-center gap-xs rounded-lg border border-dashed border-border p-xl text-center">
          <PiggyBank className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No budgets yet</p>
          <p className="text-xs text-muted-foreground">Create a budget to track planned vs actual spend by category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          {budgets.map((budget) => {
            const planned = totalPlanned(budget.lines);
            const actual = totalActual(db, budget.lines, budget.financialYear);
            const pct = utilizationPercent(actual, planned);
            return (
              <button key={budget.id} type="button" onClick={() => setDetail(budget)} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="flex items-center justify-between gap-xs">
                  <p className="text-sm font-semibold text-foreground">{budget.name}</p>
                  <Badge tone={budget.status === "approved" ? "success" : budget.status === "revised" ? "neutral" : budget.status === "closed" ? "neutral" : "warning"}>{budgetStatusLabels[budget.status]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {budget.financialYear} · {budget.lines.length} categories
                </p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-secondary">
                  <div className={`h-full rounded-full ${pct >= 100 ? "bg-error" : pct >= 85 ? "bg-warning" : "bg-success"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatMoney(actual, { compact: true })} spent</span>
                  <span>{formatMoney(planned, { compact: true })} planned</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <DetailDrawer open={!!detail} onOpenChange={(open) => !open && setDetail(null)} title={detail?.name ?? ""} description={detail ? `${detail.financialYear} · ${budgetStatusLabels[detail.status]}` : undefined}>
        {detail && (
          <div className="flex flex-col gap-sm">
            {canApprove && detail.status === "draft" && (
              <Button
                size="sm"
                onClick={() => {
                  approveBudget(detail.id, ACTOR);
                  setDetail(null);
                }}
              >
                <Check className="size-3.5" />
                Approve budget
              </Button>
            )}
            <div className="flex flex-col gap-xs">
              {detail.lines.map((line) => {
                const actual = actualForLine(db, line, detail.financialYear);
                const pct = utilizationPercent(actual, line.plannedAmount);
                const over = pct >= line.alertThresholdPercent;
                return (
                  <div key={line.id} className="rounded-lg border border-border p-sm">
                    <div className="flex items-center justify-between gap-xs">
                      <p className="text-sm font-medium text-foreground">{expenseCategoryLabels[line.category as ExpenseCategory] ?? line.category}</p>
                      {over && <AlertTriangle className="size-3.5 text-warning" />}
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-secondary">
                      <div className={`h-full rounded-full ${pct >= 100 ? "bg-error" : over ? "bg-warning" : "bg-success"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {formatMoney(actual)} of {formatMoney(line.plannedAmount)}
                      </span>
                      <span>{pct}%</span>
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
          <div>
            <Label htmlFor="budget-name">Budget name</Label>
            <Input id="budget-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={`e.g. ${CURRENT_SESSION} Operating Budget`} />
          </div>
          <div>
            <Label htmlFor="budget-fy">Financial year</Label>
            <Input id="budget-fy" value={financialYear} onChange={(e) => setFinancialYear(e.target.value)} placeholder="e.g. 2026-2027" />
          </div>

          <div className="flex flex-col gap-xs">
            <Label>Category lines</Label>
            {lines.map((line, i) => (
              <div key={i} className="flex items-end gap-xs">
                <div className="min-w-0 flex-1">
                  <Select value={line.category} onValueChange={(v) => updateLine(i, { category: v as ExpenseCategory })}>
                    <SelectTrigger aria-label={`Line ${i + 1} category`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((c) => (
                        <SelectItem key={c} value={c}>
                          {expenseCategoryLabels[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-28">
                  <Input type="number" min={0} value={line.plannedAmount.minorUnits / 100} onChange={(e) => updateLine(i, { plannedAmount: moneyFromMajor(Number(e.target.value), "INR") })} placeholder="Planned ₹" />
                </div>
                <Button variant="ghost" size="icon" disabled={lines.length <= 1} onClick={() => setLines((current) => current.filter((_, idx) => idx !== i))} aria-label={`Remove line ${i + 1}`}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={() => setLines((current) => [...current, blankLine()])}>
              <Plus className="size-3.5" />
              Add category
            </Button>
          </div>

          <Button
            disabled={!name.trim() || lines.some((l) => l.plannedAmount.minorUnits <= 0)}
            onClick={() => {
              createBudget({ name: name.trim(), session: CURRENT_SESSION, financialYear, branch: "main", lines }, ACTOR);
              setCreateOpen(false);
            }}
          >
            Create budget
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
