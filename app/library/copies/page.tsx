"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Boxes, Search } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { setCopyCondition, withdrawCopy } from "@/lib/services/copy-service";
import { roleLabels } from "@/lib/permissions/roles";
import { copyConditionLabels, copyLoanStatusLabels, type BookCopy, type CopyCondition } from "@/lib/types/library";

const conditionTone: Record<CopyCondition, "success" | "warning" | "error" | "neutral"> = {
  new: "success",
  good: "success",
  fair: "neutral",
  worn: "warning",
  damaged: "error",
  lost: "error",
  "under-repair": "warning",
};

export default function CopiesPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const actor = { name: "Librarian", role: roleLabels[role] };
  const [query, setQuery] = useState("");
  const [, force] = useState(0);

  const bookTitle = (id: string) => db.books.find((b) => b.id === id)?.title ?? id;
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.bookCopies.filter((c) => (q ? c.barcode.toLowerCase().includes(q) || c.accessionNumber.toLowerCase().includes(q) || (db.books.find((b) => b.id === c.bookId)?.title ?? "").toLowerCase().includes(q) : true));
  }, [db.bookCopies, db.books, query]);

  if (!can("library.view")) return <PermissionDenied action="view copies" role={roleLabels[role]} />;
  const canManage = can("library.manageCatalogue");

  const columns: ColumnDef<BookCopy>[] = [
    { id: "copy", header: "Copy", alwaysVisible: true, sortValue: (c) => c.accessionNumber, cell: (c) => (
      <Link href={`/library/books/${c.bookId}`} className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground hover:underline">{bookTitle(c.bookId)}</p>
        <p className="truncate text-xs text-muted-foreground">{c.accessionNumber} · {c.barcode}</p>
      </Link>
    ) },
    { id: "condition", header: "Condition", cell: (c) => <Badge tone={conditionTone[c.condition]}>{copyConditionLabels[c.condition]}</Badge> },
    { id: "loan", header: "Status", align: "right", cell: (c) => <Badge tone={c.loanStatus === "on-shelf" ? "success" : c.loanStatus === "issued" ? "info" : "neutral"}>{copyLoanStatusLabels[c.loanStatus]}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Physical copies</h1>
        <p className="text-xs text-muted-foreground">{db.bookCopies.length} copies · condition, location and loan status</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search barcode, accession or title…" className="pl-8" aria-label="Search copies" />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(c) => c.id}
        caption="Physical copies"
        isFiltered={query.trim() !== ""}
        emptyIcon={Boxes}
        emptyTitle="No copies found"
        rowActions={
          canManage
            ? [
                { key: "repair", label: "Send for repair", onSelect: (c) => { setCopyCondition(c.id, "under-repair", actor); force((n) => n + 1); }, hidden: (c) => c.loanStatus === "issued" },
                { key: "damaged", label: "Mark damaged", onSelect: (c) => { setCopyCondition(c.id, "damaged", actor); force((n) => n + 1); }, hidden: (c) => c.loanStatus === "issued" },
                { key: "lost", label: "Mark lost", destructive: true, onSelect: (c) => { setCopyCondition(c.id, "lost", actor); force((n) => n + 1); }, hidden: (c) => c.loanStatus === "issued" },
                { key: "withdraw", label: "Withdraw", destructive: true, onSelect: (c) => { withdrawCopy(c.id, actor); force((n) => n + 1); }, hidden: (c) => c.loanStatus === "issued" || c.loanStatus === "withdrawn" },
              ]
            : undefined
        }
        renderMobileCard={(c) => (
          <Link href={`/library/books/${c.bookId}`} className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{bookTitle(c.bookId)}</p>
              <Badge tone={conditionTone[c.condition]}>{copyConditionLabels[c.condition]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{c.accessionNumber} · {copyLoanStatusLabels[c.loanStatus]}</p>
          </Link>
        )}
      />
    </div>
  );
}
