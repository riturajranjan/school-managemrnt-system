"use client";

// Library copies register (Phase 9N) — real PostgreSQL/API cutover, across
// all titles.
import Link from "next/link";
import { Boxes } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useLibraryCopies } from "@/lib/hooks/api/use-library-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { LibraryBookCopyDto, LibraryCopyStatusDto } from "@/lib/api/contracts";

const statusTone: Record<LibraryCopyStatusDto, "success" | "warning" | "error" | "neutral"> = { available: "success", issued: "neutral", lost: "error", damaged: "warning", archived: "neutral" };

export default function LibraryCopiesPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: copies, loading, error } = useLibraryCopies();

  if (!capabilitiesLoading && !hasServerPermission("library.view")) {
    return <PermissionDenied action="view the copy register" role={roleLabels[role]} backHref="/library" />;
  }

  const columns: ColumnDef<LibraryBookCopyDto>[] = [
    {
      id: "accession", header: "Accession", alwaysVisible: true, sortValue: (c) => c.accessionNumber,
      cell: (c) => (
        <Link href={`/library/books/${c.bookId}`} className="min-w-0">
          <p className="text-sm font-medium text-foreground underline-offset-2 hover:underline">{c.accessionNumber}</p>
          <p className="text-xs text-muted-foreground">{c.bookTitle}</p>
        </Link>
      ),
    },
    { id: "shelf", header: "Shelf", cell: (c) => <span className="text-sm text-muted-foreground">{c.shelfLocation ?? "—"}</span>, defaultVisible: false },
    { id: "status", header: "Status", align: "right", cell: (c) => <Badge tone={statusTone[c.status]}>{c.status}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Copies</h1>
        <p className="text-xs text-muted-foreground">Physical copy register across the whole catalogue</p>
      </div>

      {error ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error}</p>
      ) : loading && copies.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={copies}
          getRowId={(c) => c.id}
          caption="Copies"
          renderMobileCard={(c) => (
            <Link href={`/library/books/${c.bookId}`} className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
              <div className="flex items-center justify-between gap-xs">
                <p className="truncate text-sm font-semibold text-foreground">{c.accessionNumber}</p>
                <Badge tone={statusTone[c.status]}>{c.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{c.bookTitle}</p>
            </Link>
          )}
          emptyIcon={Boxes}
          emptyTitle="No copies registered yet"
        />
      )}
    </div>
  );
}
