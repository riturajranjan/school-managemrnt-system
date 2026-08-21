"use client";

// Book detail (Phase 9N) — real PostgreSQL/API cutover. Title-level record +
// its real physical copies (accession-numbered, server-generated).
import Link from "next/link";
import { use, useState } from "react";
import { AlertTriangle, ArrowLeft, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import {
  createLibraryCopyRequest,
  markCopyLostRequest,
  setCopyStatusRequest,
  updateLibraryBookRequest,
  useLibraryBook,
  useLibraryCopies,
} from "@/lib/hooks/api/use-library-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { LibraryBookStatusDto, LibraryCopyStatusDto } from "@/lib/api/contracts";

const bookStatusTone: Record<LibraryBookStatusDto, "success" | "neutral"> = { active: "success", archived: "neutral" };
const copyStatusTone: Record<LibraryCopyStatusDto, "success" | "warning" | "error" | "neutral"> = { available: "success", issued: "neutral", lost: "error", damaged: "warning", archived: "neutral" };

export default function BookDetailPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = use(params);
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: book, loading, error, reload } = useLibraryBook(bookId);
  const { data: copies, reload: reloadCopies } = useLibraryCopies({ bookId });

  const [addOpen, setAddOpen] = useState(false);
  const [shelfLocation, setShelfLocation] = useState("");
  const [barcode, setBarcode] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!capabilitiesLoading && !hasServerPermission("library.view")) {
    return <PermissionDenied action="view this book" role={roleLabels[role]} backHref="/library/books" />;
  }
  const canManage = hasServerPermission("library.manage");

  if (loading) return <p className="py-2xl text-center text-sm text-muted-foreground">Loading…</p>;
  if (error || !book) {
    return (
      <div className="flex flex-col items-center gap-sm py-2xl text-center">
        <p className="text-sm font-medium text-foreground">{error ?? "Book not found"}</p>
        <Button asChild variant="outline"><Link href="/library/books">Back to catalogue</Link></Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back"><Link href="/library/books"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-foreground">{book.title}</h1>
          <p className="truncate text-xs text-muted-foreground">{book.author}{book.publisher ? ` · ${book.publisher}` : ""}</p>
        </div>
        <Badge tone={bookStatusTone[book.status]}>{book.status}</Badge>
      </div>

      {canManage && (
        <div className="flex flex-wrap gap-xs">
          {book.status === "active" ? (
            <Button size="sm" variant="ghost" onClick={async () => { await updateLibraryBookRequest(book.id, { status: "archived" }); reload(); }}>Archive</Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={async () => { await updateLibraryBookRequest(book.id, { status: "active" }); reload(); }}>Reactivate</Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-sm rounded-lg border border-border bg-surface p-md sm:grid-cols-4">
        <Field label="ISBN" value={book.isbn ?? "—"} />
        <Field label="Category" value={book.category ?? "—"} />
        <Field label="Language" value={book.language ?? "—"} />
        <Field label="Published" value={book.publicationYear ? String(book.publicationYear) : "—"} />
      </div>
      {book.description && <p className="text-sm text-muted-foreground">{book.description}</p>}

      <section className="flex flex-col gap-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Copies ({book.availableCount}/{book.copyCount} available)</h2>
          {canManage && (
            <Button size="sm" variant="outline" onClick={() => { setSaveError(null); setAddOpen(true); }}>
              <Plus className="size-3.5" />
              Add copy
            </Button>
          )}
        </div>
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
          {copies.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-sm p-sm">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{c.accessionNumber}</p>
                <p className="text-xs text-muted-foreground">{c.shelfLocation ?? "No shelf location"}{c.barcode ? ` · ${c.barcode}` : ""}</p>
              </div>
              <div className="flex items-center gap-xs">
                <Badge tone={copyStatusTone[c.status]}>{c.status}</Badge>
                {canManage && c.status === "available" && (
                  <>
                    <Button size="sm" variant="ghost" onClick={async () => { await setCopyStatusRequest(c.id, "damaged"); reloadCopies(); }}>Mark damaged</Button>
                    <Button size="sm" variant="ghost" className="text-error" onClick={async () => { await markCopyLostRequest(c.id); reloadCopies(); }}>Mark lost</Button>
                  </>
                )}
                {canManage && c.status === "issued" && (
                  <Button size="sm" variant="ghost" className="text-error" onClick={async () => { await markCopyLostRequest(c.id); reloadCopies(); }}>Mark lost</Button>
                )}
                {canManage && c.status === "damaged" && (
                  <Button size="sm" variant="ghost" onClick={async () => { await setCopyStatusRequest(c.id, "available"); reloadCopies(); }}>Restore</Button>
                )}
              </div>
            </div>
          ))}
          {copies.length === 0 && <p className="p-md text-center text-sm text-muted-foreground">No copies added yet</p>}
        </div>
      </section>

      <DetailDrawer open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setSaveError(null); }} title="Add copy" description="Accession number is generated automatically">
        <div className="flex flex-col gap-sm">
          {saveError && (
            <p className="flex items-center gap-1 text-xs text-error"><AlertTriangle className="size-3.5" />{saveError}</p>
          )}
          <div>
            <Label htmlFor="copy-shelf">Shelf location</Label>
            <Input id="copy-shelf" value={shelfLocation} onChange={(e) => setShelfLocation(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <Label htmlFor="copy-barcode">Barcode</Label>
            <Input id="copy-barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Optional" />
          </div>
          <Button
            onClick={async () => {
              const res = await createLibraryCopyRequest(book.id, { shelfLocation: shelfLocation.trim() || undefined, barcode: barcode.trim() || undefined });
              if (!res.success) { setSaveError(res.error.message); return; }
              setAddOpen(false);
              setShelfLocation(""); setBarcode("");
              reloadCopies(); reload();
            }}
          >
            Add copy
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
