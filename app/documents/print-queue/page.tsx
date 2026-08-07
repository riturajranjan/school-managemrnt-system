"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, Printer, RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { clearPrintedJobs, removePrintItem, setPrintStatus, updatePrintItem } from "@/lib/services/documents-service";
import { roleLabels } from "@/lib/permissions/roles";
import { documentTypeLabels, paperSizeLabels, printLayoutLabels, printStatusLabels, printStatusTone, type PrintLayout } from "@/lib/types/documents";
import { formatDateTime } from "@/lib/utils";

export default function PrintCentrePage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [, force] = useState(0);

  const queue = useMemo(() => [...db.printQueue].sort((a, b) => b.addedAt.localeCompare(a.addedAt)), [db.printQueue]);

  if (!can("documents.view")) return <PermissionDenied action="view the print centre" role={roleLabels[role]} backHref="/documents" />;
  const canPrint = can("documents.print");
  const bump = () => force((n) => n + 1);

  const pending = queue.filter((p) => p.status !== "printed" && p.status !== "cancelled").length;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Printer className="size-5 text-primary" /> Print Centre</h1><p className="text-xs text-muted-foreground">{pending} pending · {queue.length} total jobs</p></div>
        {canPrint && <Button size="sm" variant="outline" onClick={() => { clearPrintedJobs(); bump(); }}><Trash2 className="size-3.5" /> Clear printed</Button>}
      </div>

      <div className="flex flex-col gap-sm">
        {queue.map((p) => (
          <div key={p.id} className="rounded-lg border border-border bg-surface p-sm">
            <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><p className="truncate text-sm font-medium text-foreground">{p.documentNumber}</p><Badge tone={printStatusTone[p.status]}>{printStatusLabels[p.status]}</Badge></div>
                <p className="truncate text-xs text-muted-foreground">{documentTypeLabels[p.documentType]} · {p.owner} · {paperSizeLabels[p.paperSize]} · {formatDateTime(p.addedAt)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-xs">
                {/* Copies */}
                <div className="flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5">
                  <button type="button" aria-label="Fewer copies" disabled={!canPrint} onClick={() => { updatePrintItem(p.id, { copies: p.copies - 1 }); bump(); }} className="text-muted-foreground disabled:opacity-40"><Minus className="size-3.5" /></button>
                  <span className="min-w-6 text-center text-xs tabular-nums text-foreground">{p.copies}</span>
                  <button type="button" aria-label="More copies" disabled={!canPrint} onClick={() => { updatePrintItem(p.id, { copies: p.copies + 1 }); bump(); }} className="text-muted-foreground disabled:opacity-40"><Plus className="size-3.5" /></button>
                </div>
                {/* Layout */}
                <Select value={p.layout} onValueChange={(v) => { if (canPrint) { updatePrintItem(p.id, { layout: v as PrintLayout }); bump(); } }}>
                  <SelectTrigger aria-label="Layout" className="h-7 w-40 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(printLayoutLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
                {canPrint && p.status !== "printed" && <Button size="sm" onClick={() => { setPrintStatus(p.id, "printed"); bump(); }}><Printer className="size-3.5" /> Print</Button>}
                {canPrint && p.status === "failed" && <Button size="sm" variant="outline" onClick={() => { setPrintStatus(p.id, "queued"); bump(); }}><RotateCcw className="size-3.5" /> Retry</Button>}
                {canPrint && <button type="button" aria-label="Remove" onClick={() => { removePrintItem(p.id); bump(); }} className="text-muted-foreground hover:text-error"><Trash2 className="size-4" /></button>}
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{p.pages} page(s) · Printer: {p.printer} · added by {p.addedBy}</p>
          </div>
        ))}
        {queue.length === 0 && <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">The print queue is empty.</div>}
      </div>
    </div>
  );
}
