"use client";

import { useState } from "react";
import { Plus, TrendingUp } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { formatMoney, moneyFromMajor, sumMoney } from "@/lib/finance/money";
import { recordIncome } from "@/lib/services/income-expense-service";
import { incomeCategoryLabels, type Income, type IncomeCategory } from "@/lib/types/accounting";
import { formatDate } from "@/lib/utils";

const ACTOR = { name: "Accountant", role: "Accountant" };
const categoryOptions = Object.keys(incomeCategoryLabels) as IncomeCategory[];

export default function IncomePage() {
  const db = useSisStore();
  const { can } = usePermissions();
  const canManage = can("accounting.manageIncome");

  const [createOpen, setCreateOpen] = useState(false);
  const [category, setCategory] = useState<IncomeCategory>("donations");
  const [source, setSource] = useState("");
  const [amount, setAmount] = useState(1000);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");

  const total = sumMoney(db.incomes.map((i) => i.amount), "INR");

  const columns: ColumnDef<Income>[] = [
    {
      id: "source",
      header: "Source",
      alwaysVisible: true,
      sortValue: (i) => i.source,
      cell: (i) => (
        <div>
          <p className="text-sm font-medium text-foreground">{i.source}</p>
          {i.description && <p className="text-xs text-muted-foreground">{i.description}</p>}
        </div>
      ),
    },
    { id: "category", header: "Category", cell: (i) => <Badge tone="info">{incomeCategoryLabels[i.category]}</Badge> },
    { id: "date", header: "Date", sortValue: (i) => i.date, cell: (i) => <span className="text-sm text-muted-foreground">{formatDate(i.date)}</span> },
    { id: "amount", header: "Amount", align: "right", sortValue: (i) => i.amount.minorUnits, cell: (i) => <span className="text-sm font-medium text-foreground">{formatMoney(i.amount)}</span> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Income</h1>
          <p className="text-xs text-muted-foreground">Non-fee income — donations, grants, sponsorships and more · Total {formatMoney(total)}</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            Record income
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={[...db.incomes].sort((a, b) => (a.date < b.date ? 1 : -1))}
        getRowId={(i) => i.id}
        caption="Income"
        renderMobileCard={(i) => (
          <div className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{i.source}</p>
              <p className="text-xs text-muted-foreground">
                {incomeCategoryLabels[i.category]} · {formatDate(i.date)}
              </p>
            </div>
            <span className="shrink-0 text-sm font-medium text-foreground">{formatMoney(i.amount)}</span>
          </div>
        )}
        emptyIcon={TrendingUp}
        emptyTitle="No income recorded yet"
      />

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="Record income" description="Posts a journal entry crediting the matching income account">
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="income-source">Source</Label>
            <Input id="income-source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Alumni donation" />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as IncomeCategory)}>
              <SelectTrigger aria-label="Category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {incomeCategoryLabels[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-sm">
            <div>
              <Label htmlFor="income-amount">Amount (₹)</Label>
              <Input id="income-amount" type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="income-date">Date</Label>
              <Input id="income-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="income-desc">Description</Label>
            <Input id="income-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
          </div>
          <Button
            disabled={!source.trim() || amount <= 0}
            onClick={() => {
              recordIncome({ category, amount: moneyFromMajor(amount, "INR"), date, source: source.trim(), branch: "main", description: description.trim() || undefined }, ACTOR);
              setCreateOpen(false);
              setSource("");
              setDescription("");
            }}
          >
            Record income
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
