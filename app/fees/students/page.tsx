"use client";

// UX simplification pass — "I need to check <student>'s fees" is a distinct
// mental model from "I need to record a payment" (Collect Fee) or "I need
// fee assignment" (Fee Setup). This page is just a student search that lands
// on the existing real fee ledger (the student profile's Fees tab, already
// wired to GET /api/fees/students/[id]/ledger) — no new fee data or logic.
import Link from "next/link";
import { useState } from "react";
import { Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FeeTrail } from "@/components/fees/fee-trail";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useStudentList } from "@/lib/hooks/api/use-students";
import { useStudentFeeLedger } from "@/lib/hooks/api/use-fees-api";
import { roleLabels } from "@/lib/permissions/roles";
import { formatCurrency } from "@/lib/utils";

function StudentResultRow({ studentId, name, admissionNumber, classLabel }: { studentId: string; name: string; admissionNumber: string; classLabel: string | null }) {
  const { data: ledger } = useStudentFeeLedger(studentId);
  const pending = ledger?.totals.balance ?? null;

  return (
    <Link
      href={`/students/${studentId}/fees`}
      className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm outline-none transition-colors [@media(hover:hover)]:hover:bg-surface-secondary/60 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {admissionNumber} · {classLabel ?? "—"}
        </p>
      </div>
      {pending !== null && <Badge tone={pending > 0 ? "warning" : "success"}>{pending > 0 ? `${formatCurrency(pending)} pending` : "Fully paid"}</Badge>}
    </Link>
  );
}

export default function StudentFeesSearchPage() {
  const [query, setQuery] = useState("");
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: results } = useStudentList({ search: query.trim() || undefined, pageSize: 25, status: ["active"] });
  if (!capabilitiesLoading && !hasServerPermission("fees.view")) return <PermissionDenied action="view the fees module" role={roleLabels[role]} backHref="/fees" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <FeeTrail items={[{ label: "Fees", href: "/fees" }, { label: "Student Fees" }]} />

      <div>
        <h1 className="text-lg font-semibold text-foreground">Student Fees</h1>
        <p className="text-xs text-muted-foreground">Search a student to see their fee balance and payment history.</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, admission no. or roll no." className="pl-9" autoFocus />
      </div>

      {query.trim() ? (
        <div className="flex flex-col gap-sm">
          {results.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No matching students.</p>
          ) : (
            results.map((s) => <StudentResultRow key={s.id} studentId={s.id} name={`${s.firstName} ${s.lastName}`} admissionNumber={s.admissionNumber} classLabel={s.classLabel} />)
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-surface-secondary text-muted-foreground">
            <Users className="size-5" />
          </span>
          <p className="text-sm text-muted-foreground">Start typing a student&apos;s name or admission number.</p>
        </div>
      )}
    </div>
  );
}
