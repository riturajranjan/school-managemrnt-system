"use client";

import { DocumentList, documentCompletionPercent } from "@/components/documents/document-list";
import { Progress } from "@/components/ui/progress";
import { usePermissions } from "@/components/providers/permissions-provider";
import { updateStudentDocumentStatus, uploadStudentDocument } from "@/lib/services/students-service";
import type { Student } from "@/lib/types/students";

export function StudentDocumentsTab({ student }: { student: Student }) {
  const { can } = usePermissions();
  const completion = documentCompletionPercent(student.documents);

  if (student.documents.length === 0) {
    return <p className="text-sm text-muted-foreground">No documents on file for this student yet.</p>;
  }

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
        documents={student.documents}
        canUpload={can("documents.upload")}
        canVerify={can("documents.verify")}
        onUpload={(documentId, fileName, sizeKb) => uploadStudentDocument(student.id, documentId, fileName, sizeKb, "Staff")}
        onVerify={(documentId) => updateStudentDocumentStatus(student.id, documentId, "approved", "Administrator")}
        onReject={(documentId, reason) => updateStudentDocumentStatus(student.id, documentId, "rejected", undefined, reason)}
        onRequestReupload={(documentId, reason) => updateStudentDocumentStatus(student.id, documentId, "re-upload-requested", undefined, reason)}
      />
    </div>
  );
}
