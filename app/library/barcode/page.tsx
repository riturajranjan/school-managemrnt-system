"use client";

import { useMemo, useState } from "react";
import { Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarcodeGlyph } from "@/components/library/code-label";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";

type Template = "single" | "a4" | "thermal";

export default function BarcodePage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [query, setQuery] = useState("");
  const [template, setTemplate] = useState<Template>("a4");

  const copies = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.bookCopies.filter((c) => (q ? c.barcode.toLowerCase().includes(q) || c.accessionNumber.toLowerCase().includes(q) : true)).slice(0, template === "single" ? 1 : 24);
  }, [db.bookCopies, query, template]);

  const bookTitle = (id: string) => db.books.find((b) => b.id === id)?.title ?? id;

  if (!can("library.manageBarcode")) return <PermissionDenied action="generate barcodes" role={roleLabels[role]} />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Barcode labels</h1>
          <p className="text-xs text-muted-foreground">Generate and print copy barcodes · encodes secure identifiers only</p>
        </div>
        <div className="flex gap-xs">
          <Select value={template} onValueChange={(v) => setTemplate(v as Template)}>
            <SelectTrigger className="w-40" aria-label="Label template">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Single label</SelectItem>
              <SelectItem value="a4">A4 sheet</SelectItem>
              <SelectItem value="thermal">Thermal printer</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="size-3.5" /> Print
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by barcode or accession…" className="pl-8" aria-label="Filter copies" />
      </div>

      <div className={template === "thermal" ? "flex flex-col gap-sm" : "grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-4"}>
        {copies.map((c) => (
          <div key={c.id} className="flex flex-col items-center gap-1 rounded-lg border border-border bg-surface p-sm">
            <p className="w-full truncate text-center text-xs font-medium text-foreground">{bookTitle(c.bookId)}</p>
            <BarcodeGlyph value={c.barcode} className="w-full rounded" />
            <p className="font-mono text-[10px] text-muted-foreground">{c.barcode}</p>
            <p className="text-[10px] text-muted-foreground">{c.accessionNumber}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
