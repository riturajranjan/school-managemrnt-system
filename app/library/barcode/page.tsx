"use client";

// Real PostgreSQL/API cutover (Production migration, Phase A) — reads GET
// /api/library/copies (search added for this page). Every copy already has a
// real, server-generated accessionNumber; barcode is optional free text, so
// the label always encodes barcode ?? accessionNumber — never a fabricated
// value. No BookCopy identifiers are invented here.
import { useState } from "react";
import { Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarcodeGlyph } from "@/components/library/code-label";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useLibraryCopies } from "@/lib/hooks/api/use-library-api";
import { roleLabels } from "@/lib/permissions/roles";

type Template = "single" | "a4" | "thermal";

export default function BarcodePage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [query, setQuery] = useState("");
  const [template, setTemplate] = useState<Template>("a4");
  const { data: copies, loading, error } = useLibraryCopies({ search: query.trim() || undefined });

  if (!capabilitiesLoading && !hasServerPermission("library.view")) return <PermissionDenied action="view library copies" role={roleLabels[role]} backHref="/library" />;

  const shown = copies.slice(0, template === "single" ? 1 : 24);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Barcode labels</h1>
          <p className="text-xs text-muted-foreground">Generate and print copy barcodes · encodes each copy&apos;s real accession number or barcode</p>
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
          <Button size="sm" variant="outline" onClick={() => window.print()} disabled={shown.length === 0}>
            <Printer className="size-3.5" /> Print
          </Button>
        </div>
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by barcode, accession number or title…" className="pl-8" aria-label="Search copies" />
      </div>

      {!loading && shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">
          {query.trim() ? "No copies match this search." : "No book copies yet — add copies from the Books catalogue first."}
        </p>
      ) : (
        <div className={template === "thermal" ? "flex flex-col gap-sm" : "grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-4"}>
          {shown.map((c) => {
            const code = c.barcode ?? c.accessionNumber;
            return (
              <div key={c.id} className="flex flex-col items-center gap-1 rounded-lg border border-border bg-surface p-sm">
                <p className="w-full truncate text-center text-xs font-medium text-foreground">{c.bookTitle}</p>
                <BarcodeGlyph value={code} className="w-full rounded" />
                <p className="font-mono text-[10px] text-muted-foreground">{code}</p>
                <p className="text-[10px] text-muted-foreground">Accession {c.accessionNumber}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
