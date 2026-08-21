"use client";

// Library catalogue (Phase 9N) — real PostgreSQL/API cutover.
import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useLibraryBooks } from "@/lib/hooks/api/use-library-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { LibraryBookDto, LibraryBookStatusDto } from "@/lib/api/contracts";

const statusTone: Record<LibraryBookStatusDto, "success" | "neutral"> = { active: "success", archived: "neutral" };

export default function LibraryBooksPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: books, loading, error } = useLibraryBooks();

  if (!capabilitiesLoading && !hasServerPermission("library.view")) {
    return <PermissionDenied action="view the library catalogue" role={roleLabels[role]} backHref="/library" />;
  }
  const canManage = hasServerPermission("library.manage");

  const columns: ColumnDef<LibraryBookDto>[] = [
    {
      id: "title", header: "Title", alwaysVisible: true, sortValue: (b) => b.title,
      cell: (b) => (
        <Link href={`/library/books/${b.id}`} className="min-w-0">
          <p className="text-sm font-medium text-foreground underline-offset-2 hover:underline">{b.title}</p>
          <p className="text-xs text-muted-foreground">{b.author}</p>
        </Link>
      ),
    },
    { id: "category", header: "Category", cell: (b) => <span className="text-sm text-muted-foreground">{b.category ?? "—"}</span>, defaultVisible: false },
    { id: "isbn", header: "ISBN", cell: (b) => <span className="text-sm text-muted-foreground">{b.isbn ?? "—"}</span>, defaultVisible: false },
    { id: "copies", header: "Copies", align: "right", cell: (b) => <span className="text-sm text-foreground">{b.availableCount}/{b.copyCount}</span> },
    { id: "status", header: "Status", align: "right", cell: (b) => <Badge tone={statusTone[b.status]}>{b.status}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Catalogue</h1>
          <p className="text-xs text-muted-foreground">Book titles and available copies</p>
        </div>
        {canManage && (
          <Button asChild size="sm">
            <Link href="/library/books/new">
              <Plus className="size-3.5" />
              Add book
            </Link>
          </Button>
        )}
      </div>

      {error ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error}</p>
      ) : loading && books.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={books}
          getRowId={(b) => b.id}
          caption="Books"
          renderMobileCard={(b) => (
            <Link href={`/library/books/${b.id}`} className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
              <div className="flex items-center justify-between gap-xs">
                <p className="truncate text-sm font-semibold text-foreground">{b.title}</p>
                <Badge tone={statusTone[b.status]}>{b.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{b.author} · {b.availableCount}/{b.copyCount} available</p>
            </Link>
          )}
          emptyIcon={BookOpen}
          emptyTitle="No books in the catalogue yet"
        />
      )}
    </div>
  );
}
