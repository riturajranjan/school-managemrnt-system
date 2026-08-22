"use client";

// Document detail (Phase 9V) — real PostgreSQL/API cutover. Reissue/reprint/
// print-queue are dropped (no real print-queue/reissue-as-version model in
// this phase); void is the only real lifecycle action.
import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { DocumentSheet } from "@/components/documents/document-sheet";
import { IdCard } from "@/components/documents/id-card";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useGeneratedDocument, voidDocumentRequest } from "@/lib/hooks/api/use-document-studio-api";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDateTime } from "@/lib/utils";

const statusTone = { generated: "success", void: "error" } as const;

export default function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: doc, loading, reload } = useGeneratedDocument(id);
  const [voidReason, setVoidReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!capabilitiesLoading && !hasServerPermission("documents.view")) return <PermissionDenied action="view this document" role={roleLabels[role]} backHref="/documents/history" />;
  if (loading) return <p className="py-2xl text-center text-sm text-muted-foreground">Loading…</p>;
  if (!doc) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Document not found. <Link href="/documents/history" className="text-primary">Back</Link></div>;

  const canVoid = hasServerPermission("documents.void");

  async function onVoid() {
    if (!voidReason.trim()) return;
    const res = await voidDocumentRequest(id, { reason: voidReason.trim() });
    if (!res.success) { setError(res.error.message); return; }
    setError(null);
    setVoidReason("");
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href="/documents/history"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h1 className="truncate text-lg font-semibold text-foreground">{doc.documentNumber}</h1><Badge tone={statusTone[doc.status]}>{doc.status}</Badge></div><p className="text-xs text-muted-foreground">{doc.docType} · {doc.recipientName}</p></div>
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-xs text-error">{error}</p>}

      <div className="grid grid-cols-1 gap-md lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex items-start justify-center rounded-lg border border-border bg-surface-secondary/40 p-md">
          {"cardNumber" in doc.rendered ? <IdCard card={doc.rendered} /> : <DocumentSheet data={doc.rendered} />}
        </div>

        <div className="flex flex-col gap-md">
          <div className="rounded-lg border border-border bg-surface p-md text-sm">
            <h2 className="mb-sm text-sm font-semibold text-foreground">Details</h2>
            <dl className="grid grid-cols-2 gap-y-1.5">
              <dt className="text-muted-foreground">Template</dt><dd className="text-foreground">{doc.templateName}</dd>
              <dt className="text-muted-foreground">Version</dt><dd className="text-foreground">v{doc.templateVersion}</dd>
              <dt className="text-muted-foreground">Generated</dt><dd className="text-foreground">{formatDateTime(doc.generatedAt)}</dd>
              <dt className="text-muted-foreground">By</dt><dd className="text-foreground">{doc.generatedByName}</dd>
              {doc.voidedAt && (<><dt className="text-muted-foreground">Voided</dt><dd className="text-foreground">{formatDateTime(doc.voidedAt)}</dd></>)}
              {doc.voidReason && (<><dt className="text-muted-foreground">Reason</dt><dd className="text-foreground">{doc.voidReason}</dd></>)}
            </dl>
            {canVoid && doc.status === "generated" && (
              <div className="mt-sm flex flex-col gap-xs">
                <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Reason for voiding (required)" rows={2} />
                <Button size="sm" variant="ghost" className="w-fit" disabled={!voidReason.trim()} onClick={onVoid}><Ban className="size-3.5" /> Void document</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
