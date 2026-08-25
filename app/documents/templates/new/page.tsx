"use client";

// New template (Phase 9V) — real create. Step 1 picks the immutable identity
// (code/name/docType, which fixes kind+subjectType); step 2 reuses the
// existing TemplateBuilder exactly as-is for content, saved via a real POST.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TemplateBuilder } from "@/components/documents/template-builder";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { createDocumentTemplateRequest } from "@/lib/hooks/api/use-document-studio-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { DocumentTemplate } from "@/lib/types/documents";
import type { DocTypeDto } from "@/lib/api/contracts";

const DOC_TYPE_LABEL: Record<DocTypeDto, string> = {
  "student-id": "Student ID card",
  "staff-id": "Staff ID card",
  "bonafide-certificate": "Bonafide certificate",
  "study-certificate": "Study certificate",
  "achievement-certificate": "Activity achievement certificate",
  "employment-certificate": "Employment certificate",
};
const DOC_TYPE_KIND: Record<DocTypeDto, DocumentTemplate["kind"]> = {
  "student-id": "id-card",
  "staff-id": "id-card",
  "bonafide-certificate": "student-certificate",
  "study-certificate": "student-certificate",
  "achievement-certificate": "student-certificate",
  "employment-certificate": "staff-certificate",
};

function blank(docType: DocTypeDto): DocumentTemplate {
  const isIdCard = docType === "student-id" || docType === "staff-id";
  return {
    id: "new",
    name: "Untitled template",
    kind: DOC_TYPE_KIND[docType],
    docType,
    paperSize: isIdCard ? "cr80" : "cert-portrait",
    orientation: isIdCard ? "landscape" : "portrait",
    accent: "#18b0c8",
    style: isIdCard ? "premium-teal" : undefined,
    sections: isIdCard
      ? [
          {
            id: "s-logo",
            type: "logo",
            label: "Logo",
            show: true,
            align: "center",
            fontSize: "sm",
            fontWeight: "normal",
            order: 0,
          },
          {
            id: "s-photo",
            type: "photo",
            label: "Photo",
            show: true,
            align: "left",
            fontSize: "sm",
            fontWeight: "normal",
            order: 1,
          },
          {
            id: "s-name",
            type: "name",
            label: "Name",
            show: true,
            align: "left",
            fontSize: "base",
            fontWeight: "bold",
            order: 2,
          },
          {
            id: "s-qr",
            type: "qr",
            label: "QR",
            show: true,
            align: "right",
            fontSize: "sm",
            fontWeight: "normal",
            order: 3,
          },
        ]
      : [
          {
            id: "s-logo",
            type: "logo",
            label: "Logo",
            show: true,
            align: "center",
            fontSize: "sm",
            fontWeight: "normal",
            order: 0,
          },
          {
            id: "s-school",
            type: "school-name",
            label: "School name",
            show: true,
            align: "center",
            fontSize: "lg",
            fontWeight: "bold",
            order: 1,
          },
          {
            id: "s-num",
            type: "document-number",
            label: "Document number",
            show: true,
            align: "right",
            fontSize: "xs",
            fontWeight: "normal",
            order: 2,
          },
          {
            id: "s-body",
            type: "body",
            label: "Body",
            show: true,
            align: "center",
            fontSize: "sm",
            fontWeight: "normal",
            order: 3,
          },
          {
            id: "s-sign",
            type: "signature",
            label: "Signature",
            show: true,
            align: "right",
            fontSize: "sm",
            fontWeight: "normal",
            order: 4,
          },
          {
            id: "s-footer",
            type: "footer",
            label: "Footer",
            show: true,
            align: "center",
            fontSize: "xs",
            fontWeight: "normal",
            order: 5,
          },
        ],
    variables:
      docType === "bonafide-certificate" || docType === "study-certificate"
        ? [
            "student.fullName",
            "student.admissionNumber",
            "student.class",
            "academicSession.name",
            "school.name",
          ]
        : docType === "achievement-certificate"
          ? ["student.fullName", "achievement.title", "school.name"]
          : docType === "employment-certificate"
            ? [
                "staff.fullName",
                "staff.employeeCode",
                "staff.designation",
                "staff.joiningDate",
                "school.name",
              ]
            : docType === "student-id"
              ? [
                  "student.fullName",
                  "student.admissionNumber",
                  "student.class",
                  "school.name",
                ]
              : ["staff.fullName", "staff.employeeCode", "school.name"],
    usageCount: 0,
    updatedAt: new Date().toISOString().slice(0, 10),
    status: "draft",
    isDefault: false,
    thumbnailTone: "info",
  };
}

export default function NewTemplatePage() {
  const router = useRouter();
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [step, setStep] = useState<"identity" | "content">("identity");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [docType, setDocType] = useState<DocTypeDto>("bonafide-certificate");
  const [error, setError] = useState<string | null>(null);

  if (!capabilitiesLoading && !hasServerPermission("documents.manageTemplates"))
    return (
      <PermissionDenied
        action="create templates"
        role={roleLabels[role]}
        backHref="/documents/templates"
      />
    );

  async function onSave(edited: DocumentTemplate) {
    const res = await createDocumentTemplateRequest({
      code,
      name: edited.name,
      docType,
      paperSize: edited.paperSize,
      orientation: edited.orientation,
      accent: edited.accent,
      style: edited.style,
      sections: edited.sections,
      variables: edited.variables,
    });
    if (!res.success) {
      setError(res.error.message);
      return;
    }
    router.push(`/documents/templates/${res.data.id}`);
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost">
          <Link href="/documents/templates">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            New template
          </h1>
          <p className="text-xs text-muted-foreground">
            Structured builder — content is validated server-side before it can
            go active.
          </p>
        </div>
      </div>

      {step === "identity" ? (
        <div className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
          <div>
            <Label htmlFor="tpl-code">Code *</Label>
            <Input
              id="tpl-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. BONAFIDE-STD"
            />
          </div>
          <div>
            <Label htmlFor="tpl-name-i">Name *</Label>
            <Input
              id="tpl-name-i"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bonafide Certificate"
            />
          </div>
          <div>
            <Label>Document type</Label>
            <Select
              value={docType}
              onValueChange={(v) => setDocType(v as DocTypeDto)}>
              <SelectTrigger aria-label="Document type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DOC_TYPE_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            className="w-fit"
            disabled={!code.trim() || !name.trim()}
            onClick={() => setStep("content")}>
            Continue
          </Button>
        </div>
      ) : (
        <>
          {error && (
            <p className="rounded-md border border-error/30 bg-error/8 p-sm text-xs text-error">
              {error}
            </p>
          )}
          <TemplateBuilder
            initial={{ ...blank(docType), name }}
            onSave={onSave}
          />
        </>
      )}
    </div>
  );
}
