"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen, Download, Plus, Search, Upload } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookCover } from "@/components/library/book-cover";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { availabilityForBook, deriveBookStatus } from "@/lib/selectors/book-availability";
import { bookStatusLabels, resourceTypeLabels, type Book, type BookStatus } from "@/lib/types/library";
import { downloadTextFile } from "@/lib/utils";

const statusTone: Record<BookStatus, "success" | "warning" | "error" | "neutral" | "info"> = {
  available: "success",
  limited: "warning",
  "fully-issued": "warning",
  reserved: "info",
  "reference-only": "neutral",
  lost: "error",
  damaged: "error",
  archived: "neutral",
  "digital-only": "info",
};

export function CatalogueView({ heading = "Catalogue", description = "Books, textbooks, references and digital resources" }: { heading?: string; description?: string }) {
  const db = useSisStore();
  const { can } = usePermissions();
  const canManage = can("library.manageCatalogue");

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");

  const authorName = (id?: string) => db.authors.find((a) => a.id === id)?.name ?? "—";
  const categoryName = (id?: string) => db.bookCategories.find((c) => c.id === id)?.name ?? "—";

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.books
      .filter((b) => !b.archived)
      .filter((b) => (category === "all" ? true : b.categoryId === category))
      .filter((b) => {
        if (status === "all") return true;
        const derived = deriveBookStatus(b.status, b.referenceOnly, availabilityForBook(db, b.id));
        return derived === status;
      })
      .filter((b) => (q ? b.title.toLowerCase().includes(q) || (b.isbn ?? "").toLowerCase().includes(q) || b.accessionNumber.toLowerCase().includes(q) || authorName(b.authorId).toLowerCase().includes(q) : true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, query, category, status]);

  const isFiltered = query.trim() !== "" || category !== "all" || status !== "all";

  function exportCsv() {
    const header = "Title,Author,ISBN,Accession,Category,Available,Total,Status";
    const lines = rows.map((b) => {
      const av = availabilityForBook(db, b.id);
      const st = deriveBookStatus(b.status, b.referenceOnly, av);
      return [b.title, authorName(b.authorId), b.isbn ?? "", b.accessionNumber, categoryName(b.categoryId), av.available, av.total, bookStatusLabels[st]].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    downloadTextFile("catalogue.csv", [header, ...lines].join("\n"));
  }

  const columns: ColumnDef<Book>[] = [
    {
      id: "title",
      header: "Title",
      alwaysVisible: true,
      sortValue: (b) => b.title,
      cell: (b) => (
        <Link href={`/library/books/${b.id}`} className="flex min-w-0 items-center gap-sm">
          <BookCover title={b.title} color={b.coverColor} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground underline-offset-2 hover:underline">{b.title}</span>
            <span className="block truncate text-xs text-muted-foreground">{authorName(b.authorId)} · {b.accessionNumber}</span>
          </span>
        </Link>
      ),
    },
    { id: "type", header: "Type", cell: (b) => <Badge tone="neutral">{resourceTypeLabels[b.referenceOnly ? "reference" : "book"]}</Badge>, defaultVisible: false },
    { id: "category", header: "Category", cell: (b) => <span className="text-sm text-muted-foreground">{categoryName(b.categoryId)}</span> },
    {
      id: "availability",
      header: "Availability",
      align: "right",
      sortValue: (b) => availabilityForBook(db, b.id).available,
      cell: (b) => {
        const av = availabilityForBook(db, b.id);
        return (
          <span className="text-sm text-foreground">
            <span className={av.available > 0 ? "text-success" : "text-warning"}>{av.available}</span>
            <span className="text-muted-foreground"> / {av.total}</span>
          </span>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      align: "right",
      cell: (b) => {
        const st = deriveBookStatus(b.status, b.referenceOnly, availabilityForBook(db, b.id));
        return <Badge tone={statusTone[st]}>{bookStatusLabels[st]}</Badge>;
      },
    },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{heading}</h1>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap gap-xs">
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="size-3.5" /> Export
          </Button>
          {canManage && (
            <>
              <Button asChild size="sm" variant="outline">
                <Link href="/library/catalog?import=1">
                  <Upload className="size-3.5" /> Import
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/library/books/new">
                  <Plus className="size-3.5" /> Add book
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, author, ISBN or accession…" className="pl-8" aria-label="Search catalogue" />
        </div>
        <div className="flex gap-xs">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-40" aria-label="Filter by category">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {db.bookCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(["available", "limited", "fully-issued", "reserved", "reference-only", "digital-only"] as BookStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {bookStatusLabels[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(b) => b.id}
        caption="Catalogue"
        isFiltered={isFiltered}
        emptyIcon={BookOpen}
        emptyTitle="No books in the catalogue yet"
        emptyDescription="Add a book to get started."
        renderMobileCard={(b) => {
          const av = availabilityForBook(db, b.id);
          const st = deriveBookStatus(b.status, b.referenceOnly, av);
          return (
            <Link href={`/library/books/${b.id}`} className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-sm">
              <BookCover title={b.title} color={b.coverColor} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-xs">
                  <p className="truncate text-sm font-semibold text-foreground">{b.title}</p>
                  <Badge tone={statusTone[st]}>{bookStatusLabels[st]}</Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">{authorName(b.authorId)}</p>
                <p className="text-xs text-muted-foreground">
                  <span className={av.available > 0 ? "text-success" : "text-warning"}>{av.available}</span> / {av.total} available · {categoryName(b.categoryId)}
                </p>
              </div>
            </Link>
          );
        }}
      />
    </div>
  );
}
