"use client";

// Loans / circulation history (Phase 9N) — real PostgreSQL/API cutover.
import Link from "next/link";
import { BookMarked } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { returnLoanRequest, useLibraryLoans } from "@/lib/hooks/api/use-library-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { LibraryLoanDto, LibraryLoanStatusDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const statusTone: Record<LibraryLoanStatusDto, "success" | "warning" | "error" | "neutral"> = { issued: "neutral", returned: "success", lost: "error", cancelled: "neutral" };

export default function LibraryLoansPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: loans, loading, error, reload } = useLibraryLoans();

  if (!capabilitiesLoading && !hasServerPermission("library.view")) {
    return <PermissionDenied action="view library loans" role={roleLabels[role]} backHref="/library" />;
  }
  const canManage = hasServerPermission("library.manage");

  const columns: ColumnDef<LibraryLoanDto>[] = [
    {
      id: "book", header: "Book", alwaysVisible: true, sortValue: (l) => l.bookTitle,
      cell: (l) => (
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{l.bookTitle}</p>
          <p className="text-xs text-muted-foreground">{l.borrowerName} · {l.accessionNumber}</p>
        </div>
      ),
    },
    { id: "due", header: "Due", cell: (l) => <span className={`text-sm ${l.isOverdue ? "text-error" : "text-muted-foreground"}`}>{formatDate(l.dueAt)}{l.isOverdue ? ` · ${l.daysOverdue}d overdue` : ""}</span> },
    { id: "fine", header: "Fine", align: "right", cell: (l) => <span className="text-sm text-foreground">{l.fineAmount > 0 ? `₹${l.fineAmount.toFixed(2)}` : "—"}</span>, defaultVisible: false },
    { id: "status", header: "Status", align: "right", cell: (l) => <Badge tone={statusTone[l.status]}>{l.status}</Badge> },
  ];

  const rowActions: RowAction<LibraryLoanDto>[] = canManage
    ? [{ key: "return", label: "Return", hidden: (l) => l.status !== "issued", onSelect: async (l) => { await returnLoanRequest(l.id); reload(); } }]
    : [];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Loans</h1>
        <p className="text-xs text-muted-foreground">Active loans, overdue and circulation history</p>
      </div>

      {error ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error}</p>
      ) : loading && loans.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={loans}
          getRowId={(l) => l.id}
          caption="Loans"
          rowActions={rowActions}
          renderMobileCard={(l) => (
            <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
              <div className="flex items-center justify-between gap-xs">
                <p className="truncate text-sm font-semibold text-foreground">{l.bookTitle}</p>
                <Badge tone={statusTone[l.status]}>{l.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{l.borrowerName} · Due {formatDate(l.dueAt)}</p>
            </div>
          )}
          emptyIcon={BookMarked}
          emptyTitle="No loans yet"
        />
      )}

      <Link href="/library/issue-return" className="text-xs font-medium text-primary hover:underline">
        Go to Issue / Return desk
      </Link>
    </div>
  );
}
