"use client";

import { useMemo, useState } from "react";
import { Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrGlyph } from "@/components/library/code-label";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";

export default function QrPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [query, setQuery] = useState("");

  const copies = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.bookCopies.filter((c) => (q ? c.barcode.toLowerCase().includes(q) || c.accessionNumber.toLowerCase().includes(q) : true)).slice(0, 24);
  }, [db.bookCopies, query]);

  const bookTitle = (id: string) => db.books.find((b) => b.id === id)?.title ?? id;

  if (!can("library.manageBarcode")) return <PermissionDenied action="generate QR codes" role={roleLabels[role]} />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">QR codes</h1>
          <p className="text-xs text-muted-foreground">Copy and shelf QR codes · opaque secure tokens, no personal data</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer className="size-3.5" /> Print
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by barcode or accession…" className="pl-8" aria-label="Filter copies" />
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-4">
        {copies.map((c) => (
          <div key={c.id} className="flex flex-col items-center gap-1 rounded-lg border border-border bg-surface p-sm">
            <p className="w-full truncate text-center text-xs font-medium text-foreground">{bookTitle(c.bookId)}</p>
            <QrGlyph value={c.qrToken} />
            <p className="text-[10px] text-muted-foreground">{c.accessionNumber}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
