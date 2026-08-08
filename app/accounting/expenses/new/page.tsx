"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSisStore } from "@/lib/hooks/use-store";
import { moneyFromMajor, zeroMoney } from "@/lib/finance/money";
import { createExpense } from "@/lib/services/income-expense-service";
import {
  expenseCategoryLabels,
  type ExpenseCategory,
} from "@/lib/types/accounting";
import { paymentMethodLabels, type PaymentMethod } from "@/lib/types/payments";

const ACTOR = { name: "Accountant", role: "Accountant" };
const categoryOptions = Object.keys(expenseCategoryLabels) as ExpenseCategory[];
const methodOptions: PaymentMethod[] = [
  "cash",
  "bank-transfer",
  "cheque",
  "upi",
  "card",
  "demand-draft",
];

export default function NewExpensePage() {
  const router = useRouter();
  const db = useSisStore();

  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("technology");
  const [vendorId, setVendorId] = useState<string>("");
  const [amount, setAmount] = useState(1000);
  const [tax, setTax] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PaymentMethod>("bank-transfer");
  const [department, setDepartment] = useState("");
  const [recurring, setRecurring] = useState(false);

  const canSubmit = description.trim().length > 0 && amount > 0;

  return (
    <div className="mx-auto flex  flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">New expense</h1>
        <p className="text-xs text-muted-foreground">
          Submitted for approval before it can be marked paid
        </p>
      </div>

      <div className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
        <div>
          <Label htmlFor="exp-desc">Description</Label>
          <Textarea
            id="exp-desc"
            value={description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setDescription(e.target.value)
            }
            placeholder="What was this expense for?"
            rows={2}
          />
        </div>

        <div className="grid grid-cols-2 gap-sm">
          <div>
            <Label>Category</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as ExpenseCategory)}>
              <SelectTrigger aria-label="Category">
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
          <div>
            <Label>Vendor</Label>
            <Select value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger aria-label="Vendor">
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                {db.vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-sm">
          <div>
            <Label htmlFor="exp-amount">Amount (₹)</Label>
            <Input
              id="exp-amount"
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="exp-tax">Tax (₹)</Label>
            <Input
              id="exp-tax"
              type="number"
              min={0}
              value={tax}
              onChange={(e) => setTax(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-sm">
          <div>
            <Label htmlFor="exp-date">Date</Label>
            <Input
              id="exp-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <Label>Payment method</Label>
            <Select
              value={method}
              onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger aria-label="Payment method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {methodOptions.map((m) => (
                  <SelectItem key={m} value={m}>
                    {paymentMethodLabels[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="exp-dept">Department</Label>
          <Input
            id="exp-dept"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="Optional"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <Checkbox
            checked={recurring}
            onCheckedChange={(v) => setRecurring(v === true)}
          />
          Recurring expense
        </label>

        <div className="flex items-center gap-sm pt-1">
          <Button
            disabled={!canSubmit}
            onClick={() => {
              const expense = createExpense(
                {
                  date,
                  vendorId: vendorId || undefined,
                  category,
                  amount: moneyFromMajor(amount, "INR"),
                  tax: tax > 0 ? moneyFromMajor(tax, "INR") : zeroMoney("INR"),
                  paymentMethod: method,
                  branch: "main",
                  department: department.trim() || undefined,
                  description: description.trim(),
                  recurring,
                },
                ACTOR,
              );
              router.push(`/accounting/expenses?highlight=${expense.id}`);
            }}>
            Submit expense
          </Button>
          <Button
            variant="ghost"
            onClick={() => router.push("/accounting/expenses")}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
