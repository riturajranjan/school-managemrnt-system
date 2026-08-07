"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { ArrowLeft, Ban, Printer, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentSheet } from "@/components/documents/document-sheet";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { reissueDocument, reprintDocument, revokeDocument } from "@/lib/services/documents-service";
import { roleLabels } from "@/lib/permissions/roles";
import { documentStatusLabels, documentStatusTone, documentTypeLabels } from "@/lib/types/documents";
import { formatDateTime } from "@/lib/utils";

export default function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [, force] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const doc = db.generatedDocuments.find((d) => d.id === id);
  const versions = useMemo(() => (doc ? [...db.documentVersions.filter((v) => v.documentId === doc.id)].sort((a, b) => b.version - a.version) : []), [db.documentVersions, doc]);
  const template = doc ? db.documentTemplates.find((t) => t.id === doc.templateId) : undefined;

  if (!can("documents.view")) return <PermissionDenied action="view this document" role={roleLabels[role]} backHref="/documents/history" />;
  if (!doc) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Document not found. <Link href="/documents/history" className="text-primary">Back</Link></div>;

  const act = (fn: () => { ok: boolean; error?: string }) => { const r = fn(); if (!r.ok) setError(r.error ?? "Action failed."); else setError(null); force((n) => n + 1); };

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href="/documents/history"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h1 className="truncate text-lg font-semibold text-foreground">{doc.number}</h1><Badge tone={documentStatusTone[doc.status]}>{documentStatusLabels[doc.status]}</Badge></div><p className="text-xs text-muted-foreground">{documentTypeLabels[doc.type]} · {doc.recipient.name}</p></div>
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-xs text-error">{error}</p>}

      <div className="grid grid-cols-1 gap-md lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex items-start justify-center rounded-lg border border-border bg-surface-secondary/40 p-md">
          <DocumentSheet data={{ type: doc.type, kind: doc.kind, paperSize: doc.paperSize, number: doc.number, accent: template?.accent ?? "#18b0c8", recipientName: doc.recipient.name, recipientSubtitle: doc.recipient.subtitle, fields: doc.fields, signatoryName: doc.signatoryName, issuedDate: (doc.issuedDate ?? doc.generatedAt).slice(0, 10), token: doc.verificationToken, showSeal: true }} />
        </div>

        <div className="flex flex-col gap-md">
          <div className="rounded-lg border border-border bg-surface p-md text-sm">
            <h2 className="mb-sm text-sm font-semibold text-foreground">Details</h2>
            <dl className="grid grid-cols-2 gap-y-1.5">
              <dt className="text-muted-foreground">Template</dt><dd className="text-foreground">{doc.templateName}</dd>
              <dt className="text-muted-foreground">Generated</dt><dd className="text-foreground">{formatDateTime(doc.generatedAt)}</dd>
              <dt className="text-muted-foreground">By</dt><dd className="text-foreground">{doc.generatedBy}</dd>
              <dt className="text-muted-foreground">Version</dt><dd className="text-foreground">v{doc.version}</dd>
              <dt className="text-muted-foreground">Prints</dt><dd className="text-foreground">{doc.printCount}</dd>
              <dt className="text-muted-foreground">Verifications</dt><dd className="text-foreground">{doc.verifyCount}</dd>
              <dt className="text-muted-foreground">Token</dt><dd className="truncate font-mono text-xs text-foreground">{doc.verificationToken}</dd>
            </dl>
            <div className="mt-sm flex flex-wrap gap-xs">
              {can("documents.print") && <Button size="sm" variant="outline" onClick={() => act(() => reprintDocument(doc.id, roleLabels[role]))}><Printer className="size-3.5" /> Reprint</Button>}
              {can("documents.generate") && <Button size="sm" variant="outline" onClick={() => act(() => reissueDocument(doc.id, roleLabels[role], "Reissued from history"))}><RefreshCw className="size-3.5" /> Reissue</Button>}
              {can("documents.revoke") && doc.status !== "revoked" && <Button size="sm" variant="ghost" onClick={() => act(() => revokeDocument(doc.id, roleLabels[role]))}><Ban className="size-3.5" /> Revoke</Button>}
            </div>
          </div>

          {/* Version history — append-only */}
          <div className="rounded-lg border border-border bg-surface p-md">
            <h2 className="mb-sm text-sm font-semibold text-foreground">Version history</h2>
            <ol className="flex flex-col gap-0 border-l-2 border-border pl-md">
              {versions.map((v) => (
                <li key={v.id} className="relative pb-sm last:pb-0">
                  <span className="absolute -left-[21px] top-1 size-3 rounded-full border-2 border-surface bg-primary" />
                  <p className="text-sm font-medium text-foreground">V{v.version} · {v.label}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(v.at)} · {v.by}{v.note ? ` · ${v.note}` : ""}</p>
                </li>
              ))}
              {versions.length === 0 && <li className="text-sm text-muted-foreground">No version records.</li>}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
