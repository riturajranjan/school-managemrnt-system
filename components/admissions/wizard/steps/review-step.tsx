"use client";

import { AlertTriangle, Pencil, Printer } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAdmissionApplication } from "@/lib/hooks/use-admissions";
import { findClass } from "@/lib/data/seed/reference";
import type { AdmissionFormValues } from "@/lib/schemas/admission-form";
import { documentStatusLabels, documentTypeLabels } from "@/lib/types/common";
import { documentStatusTone } from "@/components/documents/status-meta";
import type { StepProps } from "../types";

function ReviewSection({ title, stepIndex, goToStep, children }: { title: string; stepIndex: number; goToStep: (i: number) => void; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-sm">
      <div className="mb-xs flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={() => goToStep(stepIndex)}>
          <Pencil className="size-3" />
          Edit
        </Button>
      </div>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

export function ReviewStep({ application, goToStep }: StepProps) {
  const { watch } = useFormContext<AdmissionFormValues>();
  const values = watch();
  const live = useAdmissionApplication(application.id) ?? application;
  const schoolClass = findClass(values.appliedClassId);

  const missing: string[] = [];
  if (!values.firstName || !values.lastName) missing.push("Student name");
  if (!values.dob) missing.push("Date of birth");
  if (!values.appliedClassId) missing.push("Applied class");
  if (!values.guardians.some((g) => g.isPrimary)) missing.push("Primary guardian");
  if (!values.line1 || !values.city) missing.push("Address");
  const missingDocs = live.documents.filter((d) => d.status === "missing").length;

  return (
    <div className="flex flex-col gap-sm">
      {missing.length > 0 && (
        <div className="flex items-start gap-sm rounded-md border border-warning/30 bg-warning/10 p-sm text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">Missing required information</p>
            <p className="text-xs">{missing.join(", ")}</p>
          </div>
        </div>
      )}

      <ReviewSection title="Student details" stepIndex={0} goToStep={goToStep}>
        <p>
          {values.firstName} {values.middleName} {values.lastName} · {values.gender} · DOB {values.dob || "—"}
        </p>
        <p>
          Applying for {schoolClass?.name ?? "—"} {values.appliedSectionPreference && `(Section ${values.appliedSectionPreference})`} · {values.admissionType}
        </p>
      </ReviewSection>

      <ReviewSection title="Parents & guardians" stepIndex={1} goToStep={goToStep}>
        {values.guardians.map((g) => (
          <p key={g.id}>
            {g.firstName} {g.lastName} — {g.role} {g.isPrimary && <Badge tone="info">Primary</Badge>} · {g.phone}
          </p>
        ))}
      </ReviewSection>

      <ReviewSection title="Address" stepIndex={2} goToStep={goToStep}>
        <p>
          {values.line1}, {values.line2 ? `${values.line2}, ` : ""}
          {values.city}, {values.state} {values.postalCode}
        </p>
      </ReviewSection>

      <ReviewSection title="Documents" stepIndex={8} goToStep={goToStep}>
        <div className="flex flex-wrap gap-1">
          {live.documents.map((d) => (
            <Badge key={d.id} tone={documentStatusTone[d.status]}>
              {d.customLabel || documentTypeLabels[d.type]}: {documentStatusLabels[d.status]}
            </Badge>
          ))}
        </div>
        {missingDocs > 0 && <p className="mt-1 text-xs text-warning">{missingDocs} document(s) still missing — can be uploaded after submission too.</p>}
      </ReviewSection>

      <Button type="button" variant="outline" onClick={() => window.print()} className="self-start">
        <Printer className="size-3.5" />
        Print summary
      </Button>
    </div>
  );
}
