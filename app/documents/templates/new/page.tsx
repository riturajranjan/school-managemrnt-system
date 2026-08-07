"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TemplateBuilder } from "@/components/documents/template-builder";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";
import type { DocumentTemplate } from "@/lib/types/documents";

const BLANK: DocumentTemplate = {
  id: "new", name: "Untitled certificate", kind: "student-certificate", docType: "bonafide-certificate", paperSize: "cert-portrait", orientation: "portrait", accent: "#18b0c8",
  sections: [
    { id: "s-logo", type: "logo", label: "Logo", show: true, align: "center", fontSize: "sm", fontWeight: "normal", order: 0 },
    { id: "s-school", type: "school-name", label: "School name", show: true, align: "center", fontSize: "lg", fontWeight: "bold", order: 1 },
    { id: "s-num", type: "document-number", label: "Document number", show: true, align: "right", fontSize: "xs", fontWeight: "normal", order: 2 },
    { id: "s-body", type: "body", label: "Body", show: true, align: "center", fontSize: "sm", fontWeight: "normal", order: 3 },
    { id: "s-sign", type: "signature", label: "Signature", show: true, align: "right", fontSize: "sm", fontWeight: "normal", order: 4 },
    { id: "s-footer", type: "footer", label: "Footer", show: true, align: "center", fontSize: "xs", fontWeight: "normal", order: 5 },
  ],
  variables: ["student_name", "class", "academic_session", "certificate_number", "issue_date"],
  usageCount: 0, updatedAt: new Date().toISOString().slice(0, 10), status: "draft", isDefault: false, thumbnailTone: "info",
};

export default function NewTemplatePage() {
  const { can, role } = usePermissions();
  if (!can("documents.manageTemplates")) return <PermissionDenied action="create templates" role={roleLabels[role]} backHref="/documents/templates" />;
  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href="/documents/templates"><ArrowLeft className="size-4" /></Link></Button>
        <div><h1 className="text-lg font-semibold text-foreground">New template</h1><p className="text-xs text-muted-foreground">Structured builder — changes are frontend-only (not persisted).</p></div>
      </div>
      <TemplateBuilder initial={BLANK} />
    </div>
  );
}
