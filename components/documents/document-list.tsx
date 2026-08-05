"use client";

import { AlertCircle, Check, Clock, FileText, History, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import type { DocumentRecord, DocumentStatus } from "@/lib/types/common";
import { documentStatusLabels, documentTypeLabels } from "@/lib/types/common";
import { formatDateTime } from "@/lib/utils";
import { documentStatusTone } from "./status-meta";

export function documentCompletionPercent(documents: DocumentRecord[]): number {
  if (documents.length === 0) return 0;
  const approved = documents.filter((d) => d.status === "approved").length;
  return Math.round((approved / documents.length) * 100);
}

export function DocumentList({
  documents,
  onUpload,
  onVerify,
  onReject,
  onRequestReupload,
  canUpload = true,
  canVerify = false,
}: {
  documents: DocumentRecord[];
  onUpload: (documentId: string, fileName: string, sizeKb: number) => void;
  onVerify: (documentId: string) => void;
  onReject: (documentId: string, reason: string) => void;
  onRequestReupload: (documentId: string, reason: string) => void;
  canUpload?: boolean;
  canVerify?: boolean;
}) {
  const [reasonFor, setReasonFor] = useState<{ documentId: string; mode: "reject" | "re-upload" } | null>(null);
  const [reason, setReason] = useState("");
  const [historyFor, setHistoryFor] = useState<DocumentRecord | null>(null);

  return (
    <div className="flex flex-col gap-sm">
      {documents.map((doc) => (
        <div key={doc.id} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-sm">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-secondary text-muted-foreground">
              <FileText className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-xs">
                <p className="truncate text-sm font-medium text-foreground">{doc.customLabel || documentTypeLabels[doc.type]}</p>
                <Badge tone={documentStatusTone[doc.status]}>{documentStatusLabels[doc.status]}</Badge>
              </div>
              {doc.fileName ? (
                <p className="truncate text-xs text-muted-foreground">
                  {doc.fileName} · {doc.sizeKb ? `${(doc.sizeKb / 1024).toFixed(1)} MB` : ""} · {doc.uploadedAt ? formatDateTime(doc.uploadedAt) : ""}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Not uploaded yet</p>
              )}
              {doc.rejectionReason && (
                <p className="mt-1 flex items-start gap-1 text-xs text-error">
                  <AlertCircle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                  {doc.rejectionReason}
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-xs">
            {doc.versions.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setHistoryFor(doc)}>
                <History className="size-3.5" />
                <span className="hidden sm:inline">History</span>
              </Button>
            )}
            {canUpload && (doc.status === "missing" || doc.status === "re-upload-requested" || doc.status === "rejected" || doc.status === "expired") && (
              <UploadButton onSelect={(file) => onUpload(doc.id, file.name, Math.round(file.size / 1024))} />
            )}
            {canUpload && (doc.status === "uploaded" || doc.status === "under-review" || doc.status === "approved") && (
              <UploadButton label="Replace" onSelect={(file) => onUpload(doc.id, file.name, Math.round(file.size / 1024))} />
            )}
            {canVerify && (doc.status === "uploaded" || doc.status === "under-review") && (
              <>
                <Button variant="outline" size="sm" onClick={() => onVerify(doc.id)}>
                  <Check className="size-3.5" />
                  Approve
                </Button>
                <Button variant="ghost" size="sm" className="text-error" onClick={() => setReasonFor({ documentId: doc.id, mode: "reject" })}>
                  <X className="size-3.5" />
                  Reject
                </Button>
              </>
            )}
            {canVerify && doc.status === "approved" && (
              <Button variant="ghost" size="sm" onClick={() => setReasonFor({ documentId: doc.id, mode: "re-upload" })}>
                <Clock className="size-3.5" />
                Request re-upload
              </Button>
            )}
          </div>
        </div>
      ))}

      <DetailDrawer
        open={reasonFor !== null}
        onOpenChange={(open) => !open && setReasonFor(null)}
        title={reasonFor?.mode === "reject" ? "Reject document" : "Request re-upload"}
        description="Explain why, so the parent knows exactly what to fix"
      >
        <div className="flex flex-col gap-sm">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Document image is blurred — please re-upload a clear scan." rows={4} />
          <Button
            onClick={() => {
              if (!reasonFor) return;
              if (reasonFor.mode === "reject") onReject(reasonFor.documentId, reason || "Document rejected");
              else onRequestReupload(reasonFor.documentId, reason || "Please re-upload this document");
              setReason("");
              setReasonFor(null);
            }}
          >
            Send
          </Button>
        </div>
      </DetailDrawer>

      <DetailDrawer open={historyFor !== null} onOpenChange={(open) => !open && setHistoryFor(null)} title="Version history" description={historyFor?.customLabel || (historyFor ? documentTypeLabels[historyFor.type] : "")}>
        <ol className="flex flex-col gap-sm">
          {historyFor?.versions.map((version, index) => (
            <li key={version.id} className="rounded-md border border-border p-sm text-sm">
              <p className="font-medium text-foreground">
                {version.fileName} {index === 0 && <span className="text-xs font-normal text-muted-foreground">(current)</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(version.uploadedAt)} · {version.uploadedBy} · {(version.sizeKb / 1024).toFixed(1)} MB
              </p>
            </li>
          ))}
        </ol>
      </DetailDrawer>
    </div>
  );
}

function UploadButton({ label = "Upload", onSelect }: { label?: string; onSelect: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
        <Upload className="size-3.5" />
        {label}
      </Button>
      <input
        ref={inputRef}
        type="file"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelect(file);
          e.target.value = "";
        }}
      />
    </>
  );
}

export function statusFilterCount(documents: DocumentRecord[], status: DocumentStatus): number {
  return documents.filter((d) => d.status === status).length;
}
