"use client";

import { useMemo, useState } from "react";
import { Eye, Printer, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { DocumentSheet } from "./document-sheet";
import { useSisStore } from "@/lib/hooks/use-store";
import { reprintDocument } from "@/lib/services/documents-service";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";
import { documentStatusLabels, documentStatusTone, documentTypeLabels, type DocumentKind } from "@/lib/types/documents";
import { formatDate } from "@/lib/utils";

/** Lists generated documents matching a set of kinds, with a print-styled
 * preview drawer and reprint action. Reused by certificate/letter/admit hubs. */
export function GeneratedDocList({ kinds, emptyLabel }: { kinds: DocumentKind[]; emptyLabel: string }) {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [, force] = useState(0);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const kindSet = useMemo(() => new Set(kinds), [kinds]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...db.generatedDocuments].filter((d) => kindSet.has(d.kind)).filter((d) => (q ? d.recipient.name.toLowerCase().includes(q) || d.number.toLowerCase().includes(q) : true)).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  }, [db.generatedDocuments, kindSet, query]);
  const doc = rows.find((d) => d.id === openId) ?? null;
  const template = doc ? db.documentTemplates.find((t) => t.id === doc.templateId) : undefined;

  return (
    <div className="flex flex-col gap-md">
      <div className="relative max-w-sm"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" aria-label="Search documents" className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary" /></div>

      <div className="flex flex-col gap-xs">
        {rows.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm">
            <div className="min-w-0"><p className="truncate font-medium text-foreground">{d.recipient.name}</p><p className="truncate text-xs text-muted-foreground">{documentTypeLabels[d.type]} · {d.number} · {formatDate(d.generatedAt.slice(0, 10))}</p></div>
            <div className="flex items-center gap-xs">
              <Badge tone={documentStatusTone[d.status]}>{documentStatusLabels[d.status]}</Badge>
              <Button size="sm" variant="outline" onClick={() => setOpenId(d.id)}><Eye className="size-3.5" /></Button>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">{emptyLabel}</div>}
      </div>

      <DetailDrawer open={Boolean(doc)} onOpenChange={(o) => !o && setOpenId(null)} title={doc ? `${doc.recipient.name} — ${documentTypeLabels[doc.type]}` : ""} description={doc?.number}>
        {doc && (
          <div className="flex flex-col gap-md">
            <DocumentSheet data={{ type: doc.type, kind: doc.kind, paperSize: doc.paperSize, number: doc.number, accent: template?.accent ?? "#18b0c8", recipientName: doc.recipient.name, recipientSubtitle: doc.recipient.subtitle, fields: doc.fields, signatoryName: doc.signatoryName, issuedDate: (doc.issuedDate ?? doc.generatedAt).slice(0, 10), token: doc.verificationToken, showSeal: true }} />
            <p className="text-center text-xs text-muted-foreground">Print-styled preview · white paper even in dark mode.</p>
            {can("documents.print") && <div className="flex justify-center"><Button size="sm" variant="outline" onClick={() => { reprintDocument(doc.id, roleLabels[role]); force((n) => n + 1); }}><Printer className="size-3.5" /> Add to print queue</Button></div>}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
