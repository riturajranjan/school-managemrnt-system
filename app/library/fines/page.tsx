"use client";

// Fines (Phase 9N) — real PostgreSQL/API cutover. Derived from the real,
// admin-editable LibraryPolicy — never invented. Payment/collection is
// deliberately deferred (see the phase's final report); this is an
// informational view only.
import Link from "next/link";
import { Wallet } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useLibraryLoans } from "@/lib/hooks/api/use-library-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { LibraryLoanDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

export default function LibraryFinesPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: loans, loading, error } = useLibraryLoans();
  const fined = loans.filter((l) => l.fineAmount > 0);

  if (!capabilitiesLoading && !hasServerPermission("library.view")) {
    return <PermissionDenied action="view library fines" role={roleLabels[role]} backHref="/library" />;
  }

  const columns: ColumnDef<LibraryLoanDto>[] = [
    {
      id: "book", header: "Book", alwaysVisible: true, sortValue: (l) => l.bookTitle,
      cell: (l) => (
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{l.bookTitle}</p>
          <p className="text-xs text-muted-foreground">{l.borrowerName}</p>
        </div>
      ),
    },
    { id: "due", header: "Due", cell: (l) => <span className="text-sm text-muted-foreground">{formatDate(l.dueAt)}</span> },
    { id: "days", header: "Days overdue", align: "right", cell: (l) => <span className="text-sm text-foreground">{l.daysOverdue}</span> },
    { id: "fine", header: "Fine", align: "right", cell: (l) => <span className="text-sm font-medium text-foreground">₹{l.fineAmount.toFixed(2)}</span> },
    { id: "status", header: "Status", align: "right", cell: (l) => <Badge tone={l.status === "issued" ? "warning" : "neutral"}>{l.status}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Fines</h1>
        <p className="text-xs text-muted-foreground">
          Calculated from the library&apos;s loan policy. Payment collection is not yet integrated —{" "}
          <Link href="/library/settings" className="text-primary hover:underline">configure the policy</Link>.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error}</p>
      ) : loading && loans.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={fined}
          getRowId={(l) => l.id}
          caption="Fines"
          renderMobileCard={(l) => (
            <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
              <div className="flex items-center justify-between gap-xs">
                <p className="truncate text-sm font-semibold text-foreground">{l.bookTitle}</p>
                <span className="text-sm font-medium text-foreground">₹{l.fineAmount.toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground">{l.borrowerName} · {l.daysOverdue}d overdue</p>
            </div>
          )}
          emptyIcon={Wallet}
          emptyTitle="No fines outstanding"
        />
      )}
    </div>
  );
}
