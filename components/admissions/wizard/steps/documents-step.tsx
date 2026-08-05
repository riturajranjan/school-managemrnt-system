"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DocumentList, documentCompletionPercent } from "@/components/documents/document-list";
import { Progress } from "@/components/ui/progress";
import { useAdmissionApplication } from "@/lib/hooks/use-admissions";
import { addCustomDocumentRequest, saveApplicationDraft, uploadDocument } from "@/lib/services/admissions-service";
import type { DocumentRecord, DocumentType } from "@/lib/types/common";
import type { StepProps } from "../types";

const requiredTypes: DocumentType[] = [
  "birth-certificate",
  "previous-report-card",
  "transfer-certificate",
  "address-proof",
  "identity-proof",
  "student-photo",
  "parent-identity-proof",
  "medical-record",
];

export function DocumentsStep({ application }: StepProps) {
  const live = useAdmissionApplication(application.id) ?? application;
  const [customLabel, setCustomLabel] = useState("");

  useEffect(() => {
    if (live.documents.length === 0) {
      const seeded: DocumentRecord[] = requiredTypes.map((type, index) => ({
        id: `${live.id}-doc-${index}`,
        ownerId: live.id,
        type,
        status: "missing",
        versions: [],
      }));
      saveApplicationDraft(live.id, { documents: seeded });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.id]);

  const completion = documentCompletionPercent(live.documents);

  return (
    <div className="flex flex-col gap-md">
      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-medium text-foreground">Document completion</span>
          <span className="text-muted-foreground">{completion}%</span>
        </div>
        <Progress value={completion} />
      </div>

      <DocumentList
        documents={live.documents}
        canUpload
        canVerify={false}
        onUpload={(documentId, fileName, sizeKb) => uploadDocument(live.id, documentId, fileName, sizeKb, "Parent portal")}
        onVerify={() => {}}
        onReject={() => {}}
        onRequestReupload={() => {}}
      />

      <div className="flex flex-col gap-sm rounded-lg border border-dashed border-border p-sm sm:flex-row sm:items-center">
        <Input placeholder="Custom document name (e.g. Sports certificate)" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} className="flex-1" />
        <Button
          type="button"
          variant="outline"
          disabled={!customLabel.trim()}
          onClick={() => {
            addCustomDocumentRequest(live.id, customLabel.trim());
            setCustomLabel("");
          }}
        >
          <Plus className="size-3.5" />
          Add document
        </Button>
      </div>
    </div>
  );
}
