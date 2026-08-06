"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useStudents, useStudentGuardians } from "@/lib/hooks/use-students";
import { useSisStore } from "@/lib/hooks/use-store";
import { formatMoney } from "@/lib/finance/money";
import { totalOutstanding } from "@/lib/selectors/fee-item-insights";
import { paymentMethodLabels } from "@/lib/types/payments";
import { formatDateTime } from "@/lib/utils";

function StudentRow({ studentId }: { studentId: string }) {
  const students = useStudents();
  const classes = useManagedClasses();
  const db = useSisStore();
  const guardians = useStudentGuardians(studentId);
  const student = students.find((s) => s.id === studentId);
  if (!student) return null;
  const items = db.studentFeeItems.filter((i) => i.studentId === studentId && i.status !== "cancelled");
  const outstanding = totalOutstanding(items);
  const guardian = guardians[0];
  const className = classes.find((c) => c.id === student.classId)?.name ?? student.classId;

  return (
    <Link
      href={`/fees/collection/new?studentId=${studentId}`}
      className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm outline-none transition-colors [@media(hover:hover)]:hover:bg-surface-secondary/60 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {student.profile.firstName} {student.profile.lastName}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {student.admissionNumber} · {className} · {guardian ? `${guardian.firstName} ${guardian.lastName}` : "No guardian on file"}
        </p>
      </div>
      <Badge tone={outstanding.minorUnits > 0 ? "warning" : "success"}>{formatMoney(outstanding, { compact: true })} due</Badge>
    </Link>
  );
}

export default function FeeCollectionSearchPage() {
  const students = useStudents();
  const db = useSisStore();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return students
      .filter((s) => {
        const fullName = `${s.profile.firstName} ${s.profile.lastName}`.toLowerCase();
        const receiptMatch = db.receipts.some((r) => r.studentId === s.id && r.receiptNumber.toLowerCase().includes(q));
        return fullName.includes(q) || s.admissionNumber.toLowerCase().includes(q) || receiptMatch;
      })
      .slice(0, 25);
  }, [query, students, db.receipts]);

  const recentPayments = [...db.payments].sort((a, b) => (a.paidAt < b.paidAt ? 1 : -1)).slice(0, 8);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Fee collection</h1>
        <p className="text-xs text-muted-foreground">Search a student to record a payment</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by student name, admission number or receipt number"
          className="pl-9"
          autoFocus
        />
      </div>

      {query.trim() && (
        <div className="flex flex-col gap-sm">
          {results.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No matching students.</p>
          ) : (
            results.map((s) => <StudentRow key={s.id} studentId={s.id} />)
          )}
        </div>
      )}

      {!query.trim() && recentPayments.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Wallet className="size-4" /> Recent payments
          </h2>
          <div className="flex flex-col gap-1">
            {recentPayments.map((p) => {
              const student = students.find((s) => s.id === p.studentId);
              return (
                <Link
                  key={p.id}
                  href={`/fees/collection/new?studentId=${p.studentId}`}
                  className="flex items-center justify-between rounded-md px-sm py-2 text-sm outline-none hover:bg-surface-secondary/60 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="min-w-0 truncate text-foreground">{student ? `${student.profile.firstName} ${student.profile.lastName}` : p.studentId}</span>
                  <span className="flex shrink-0 items-center gap-xs text-xs text-muted-foreground">
                    {paymentMethodLabels[p.method]} · {formatDateTime(p.paidAt)}
                    <span className="font-medium text-foreground">{formatMoney(p.amount)}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
