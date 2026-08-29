"use client";

// Real PostgreSQL/API cutover (Phase 9F) — reads the live student search
// (GET /api/students) and GET /api/fees/payments for the recent-payments list.
import Link from "next/link";
import { useState } from "react";
import { Search, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useStudentList } from "@/lib/hooks/api/use-students";
import { useFeePayments, useStudentFeeLedger } from "@/lib/hooks/api/use-fees-api";
import { roleLabels } from "@/lib/permissions/roles";
import { formatCurrency, formatDateTime } from "@/lib/utils";

const methodLabels: Record<string, string> = { cash: "Cash", upi: "UPI", card: "Card", bank_transfer: "Bank transfer", cheque: "Cheque", other: "Other" };

function StudentRow({ studentId, name, admissionNumber, classLabel }: { studentId: string; name: string; admissionNumber: string; classLabel: string | null }) {
  const { data: ledger } = useStudentFeeLedger(studentId);
  const outstanding = ledger?.totals.balance ?? null;

  return (
    <Link
      href={`/fees/collection/new?studentId=${studentId}`}
      className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm outline-none transition-colors [@media(hover:hover)]:hover:bg-surface-secondary/60 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {admissionNumber} · {classLabel ?? "—"}
        </p>
      </div>
      {outstanding !== null && <Badge tone={outstanding > 0 ? "warning" : "success"}>{formatCurrency(outstanding)} due</Badge>}
    </Link>
  );
}

export default function FeeCollectionSearchPage() {
  const [query, setQuery] = useState("");
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: results } = useStudentList({ search: query.trim() || undefined, pageSize: 25, status: ["active"] });
  const { data: recentPayments } = useFeePayments({ pageSize: 8 });
  if (!capabilitiesLoading && !hasServerPermission("fees.view")) return <PermissionDenied action="view the fees module" role={roleLabels[role]} backHref="/fees" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Collect Fee</h1>
        <p className="text-xs text-muted-foreground">Search for a student to record their payment.</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by student name or admission number" className="pl-9" autoFocus />
      </div>

      {query.trim() && (
        <div className="flex flex-col gap-sm">
          {results.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No matching students.</p>
          ) : (
            results.map((s) => <StudentRow key={s.id} studentId={s.id} name={`${s.firstName} ${s.lastName}`} admissionNumber={s.admissionNumber} classLabel={s.classLabel} />)
          )}
        </div>
      )}

      {!query.trim() && recentPayments.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Wallet className="size-4" /> Recent payments
          </h2>
          <div className="flex flex-col gap-1">
            {recentPayments.map((p) => (
              <Link
                key={p.id}
                href={`/fees/collection/new?studentId=${p.studentId}`}
                className="flex items-center justify-between rounded-md px-sm py-2 text-sm outline-none hover:bg-surface-secondary/60 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0 truncate text-foreground">{p.studentName}</span>
                <span className="flex shrink-0 items-center gap-xs text-xs text-muted-foreground">
                  {methodLabels[p.method]} · {formatDateTime(p.createdAt)}
                  <span className="font-medium text-foreground">{formatCurrency(p.amount)}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
