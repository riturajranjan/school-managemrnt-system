"use client";

import { DocumentList, documentCompletionPercent } from "@/components/documents/document-list";
import { Progress } from "@/components/ui/progress";
import { usePermissions } from "@/components/providers/permissions-provider";
import { updateDocumentStatus, uploadDocument } from "@/lib/services/admissions-service";
import type { AdmissionApplication } from "@/lib/types/admissions";

export function DocumentsTab({ application }: { application: AdmissionApplication }) {
  const { can } = usePermissions();
  const completion = documentCompletionPercent(application.documents);

  return (
    <div className="flex flex-col gap-md">
      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-medium text-foreground">Overall completion</span>
          <span className="text-muted-foreground">{completion}%</span>
        </div>
        <Progress value={completion} />
      </div>
      <DocumentList
        documents={application.documents}
        canUpload={can("documents.upload")}
        canVerify={can("documents.verify")}
        onUpload={(documentId, fileName, sizeKb) => uploadDocument(application.id, documentId, fileName, sizeKb, "Staff")}
        onVerify={(documentId) => updateDocumentStatus(application.id, documentId, "approved", { verifiedBy: "Admission Officer" })}
        onReject={(documentId, reason) => updateDocumentStatus(application.id, documentId, "rejected", { rejectionReason: reason })}
        onRequestReupload={(documentId, reason) => updateDocumentStatus(application.id, documentId, "re-upload-requested", { rejectionReason: reason })}
      />
    </div>
  );
}
