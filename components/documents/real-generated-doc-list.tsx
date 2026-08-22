"use client";

// Real generated-document list + preview + void (Phase 9V). Mirrors the
// original GeneratedDocList's layout, but reads/writes the real
// /api/document-studio/documents/* endpoints. A fresh component (not a
// rewrite) because the original stays in use, unmodified, by the deferred
// admit-cards/letters mock pages.
import { useState } from "react";
import { Ban, Eye, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Textarea } from "@/components/ui/input";
import { DocumentSheet } from "./document-sheet";
import { IdCard } from "./id-card";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useGeneratedDocuments, voidDocumentRequest } from "@/lib/hooks/api/use-document-studio-api";
import type { DocTypeDto } from "@/lib/api/contracts";
import { formatDateTime } from "@/lib/utils";

const statusTone = { generated: "success", void: "error" } as const;

export function RealGeneratedDocList({ docTypes, emptyLabel }: { docTypes: DocTypeDto[]; emptyLabel: string }) {
  const { hasServerPermission } = usePermissions();
  const canVoid = hasServerPermission("documents.void");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);

  const { data: rows, reload } = useGeneratedDocuments({ q: query || undefined });
  const filtered = rows.filter((d) => docTypes.includes(d.docType));
  const doc = filtered.find((d) => d.id === openId) ?? null;

  async function onVoid() {
    if (!doc || !voidReason.trim()) return;
    setVoiding(true);
    const res = await voidDocumentRequest(doc.id, { reason: voidReason.trim() });
    setVoiding(false);
    if (res.success) { setVoidReason(""); reload(); }
  }

  return (
    <div className="flex flex-col gap-md">
      <div className="relative max-w-sm"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by number…" aria-label="Search documents" className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary" /></div>

      <div className="flex flex-col gap-xs">
        {filtered.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm">
            <div className="min-w-0"><p className="truncate font-medium text-foreground">{d.recipientName}</p><p className="truncate text-xs text-muted-foreground">{d.documentNumber} · {formatDateTime(d.generatedAt)}</p></div>
            <div className="flex items-center gap-xs">
              <Badge tone={statusTone[d.status]}>{d.status}</Badge>
              <Button size="sm" variant="outline" onClick={() => { setOpenId(d.id); setVoidReason(""); }}><Eye className="size-3.5" /></Button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">{emptyLabel}</div>}
      </div>

      <DetailDrawer open={Boolean(doc)} onOpenChange={(o) => !o && setOpenId(null)} title={doc ? `${doc.recipientName} — ${doc.documentNumber}` : ""} description={doc?.status === "void" ? `Void: ${doc.voidReason}` : undefined}>
        {doc && (
          <div className="flex flex-col gap-md">
            {"cardNumber" in doc.rendered ? <IdCard card={doc.rendered} /> : <DocumentSheet data={doc.rendered} />}
            <p className="text-center text-xs text-muted-foreground">Print-styled preview · white paper even in dark mode.</p>
            {canVoid && doc.status === "generated" && (
              <div className="flex flex-col gap-xs rounded-md border border-border p-sm">
                <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Reason for voiding (required)" rows={2} />
                <Button size="sm" variant="ghost" className="w-fit" disabled={!voidReason.trim() || voiding} onClick={onVoid}><Ban className="size-3.5" /> Void document</Button>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
