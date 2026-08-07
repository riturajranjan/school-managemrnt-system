"use client";

import Link from "next/link";
import { useState } from "react";
import { BookMarked } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { markLoanLost, renewLoan, returnLoan } from "@/lib/services/loan-service";
import { roleLabels } from "@/lib/permissions/roles";
import { loanStatusLabels, type LibraryLoan, type LoanStatus } from "@/lib/types/library";
import { formatDate } from "@/lib/utils";

const statusTone: Record<LoanStatus, "success" | "warning" | "error" | "neutral" | "info"> = {
  active: "info",
  returned: "neutral",
  overdue: "error",
  lost: "error",
  renewed: "info",
  "claimed-returned": "warning",
};

export default function LoansPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const actor = { name: "Circulation Desk", role: roleLabels[role] };
  const [filter, setFilter] = useState<"active" | "overdue" | "all">("active");
  const [, force] = useState(0);
  const today = new Date().toISOString().slice(0, 10);

  if (!can("library.view")) return <PermissionDenied action="view loans" role={roleLabels[role]} />;
  const canCirculate = can("library.circulate");

  const rows = db.libraryLoans.filter((l) => {
    if (filter === "active") return l.status === "active" || l.status === "overdue" || l.status === "renewed";
    if (filter === "overdue") return l.status === "overdue" || ((l.status === "active" || l.status === "renewed") && l.dueDate < today);
    return true;
  });

  const bookTitle = (id: string) => db.books.find((b) => b.id === id)?.title ?? id;
  const memberName = (id: string) => db.libraryMembers.find((m) => m.id === id)?.name ?? id;

  const columns: ColumnDef<LibraryLoan>[] = [
    { id: "book", header: "Title", alwaysVisible: true, sortValue: (l) => bookTitle(l.bookId), cell: (l) => <Link href={`/library/books/${l.bookId}`} className="text-sm font-medium text-foreground hover:underline">{bookTitle(l.bookId)}</Link> },
    { id: "member", header: "Member", cell: (l) => <span className="text-sm text-muted-foreground">{memberName(l.memberId)}</span> },
    { id: "issued", header: "Issued", cell: (l) => <span className="text-xs text-muted-foreground">{formatDate(l.issuedAt)}</span>, defaultVisible: false, sortValue: (l) => l.issuedAt },
    { id: "due", header: "Due", sortValue: (l) => l.dueDate, cell: (l) => <span className={`text-sm ${l.dueDate < today && l.status !== "returned" ? "text-error" : "text-foreground"}`}>{formatDate(l.dueDate)}</span> },
    { id: "status", header: "Status", align: "right", cell: (l) => <Badge tone={statusTone[l.status]}>{loanStatusLabels[l.status]}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Loans</h1>
          <p className="text-xs text-muted-foreground">Active circulation, overdue tracking and renewals</p>
        </div>
        <div className="inline-flex rounded-md border border-border p-0.5">
          {(["active", "overdue", "all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded px-sm py-1.5 text-xs font-medium capitalize ${filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(l) => l.id}
        caption="Loans"
        emptyIcon={BookMarked}
        emptyTitle="No loans to show"
        rowActions={
          canCirculate
            ? [
                { key: "return", label: "Return", onSelect: (l) => { returnLoan({ loanId: l.id }, actor, today); force((n) => n + 1); }, hidden: (l) => l.status === "returned" || l.status === "lost" },
                { key: "renew", label: "Renew", onSelect: (l) => { const r = renewLoan(l.id, actor, today); if (!r.ok) alert(r.error); force((n) => n + 1); }, hidden: (l) => l.status === "returned" || l.status === "lost" },
                { key: "lost", label: "Mark lost", destructive: true, onSelect: (l) => { markLoanLost(l.id, actor, "Marked from loans list"); force((n) => n + 1); }, hidden: (l) => l.status === "returned" || l.status === "lost" },
              ]
            : undefined
        }
        renderMobileCard={(l) => (
          <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
            <div className="flex items-center justify-between gap-xs">
              <Link href={`/library/books/${l.bookId}`} className="truncate text-sm font-semibold text-foreground">{bookTitle(l.bookId)}</Link>
              <Badge tone={statusTone[l.status]}>{loanStatusLabels[l.status]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{memberName(l.memberId)} · Due {formatDate(l.dueDate)}</p>
            {canCirculate && l.status !== "returned" && l.status !== "lost" && (
              <div className="mt-1 flex gap-xs">
                <Button size="sm" variant="outline" onClick={() => { returnLoan({ loanId: l.id }, actor, today); force((n) => n + 1); }}>Return</Button>
                <Button size="sm" variant="ghost" onClick={() => { const r = renewLoan(l.id, actor, today); if (!r.ok) alert(r.error); force((n) => n + 1); }}>Renew</Button>
              </div>
            )}
          </div>
        )}
      />
    </div>
  );
}
