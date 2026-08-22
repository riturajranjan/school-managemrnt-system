// Translates resolved merge-field values into the exact ready-to-render shape
// the existing DocumentSheet/IdCard presentational components expect (Phase
// 9V). This is the ONLY place that maps registry keys onto DocumentSheetData/
// IdCardRecord field names — kept separate from merge-fields.ts so the
// sourceSnapshotJson (raw registry keys) and renderedSnapshot (presentation
// shape) stay two clearly distinct artifacts.
import type { DocTypeDto, DocumentSheetDataDto, DocumentTemplateDto, IdCardRecordDto } from "@/lib/api/contracts";

// Deterministic, decorative only — never derived from or exposed as personal
// data. Matches the mock's own use of a placeholder avatar color.
const PALETTE = ["#18b0c8", "#7c3aed", "#f59e0b", "#022c43", "#0f766e"];
function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function buildDocumentSheetData(input: {
  template: DocumentTemplateDto;
  documentNumber?: string;
  recipientName: string;
  recipientSubtitle?: string;
  resolved: Record<string, string>;
  purpose?: string;
  issuedDate?: string;
  token?: string;
}): DocumentSheetDataDto {
  const fields: Record<string, string> = {};
  if (input.resolved["student.class"]) fields.class = input.resolved["student.class"];
  if (input.resolved["academicSession.name"]) fields.session = input.resolved["academicSession.name"];
  if (input.resolved["student.admissionNumber"]) fields.admissionNumber = input.resolved["student.admissionNumber"];
  if (input.resolved["staff.employeeCode"]) fields.employeeId = input.resolved["staff.employeeCode"];
  if (input.resolved["staff.designation"]) fields.designation = input.resolved["staff.designation"];
  if (input.resolved["staff.joiningDate"]) fields.joiningDate = input.resolved["staff.joiningDate"];
  if (input.resolved["achievement.title"]) fields.eventName = input.resolved["achievement.title"];
  if (input.purpose) fields.purpose = input.purpose;

  return {
    type: input.template.docType,
    kind: input.template.kind,
    paperSize: input.template.paperSize,
    number: input.documentNumber,
    accent: input.template.accent,
    recipientName: input.recipientName,
    recipientSubtitle: input.recipientSubtitle,
    fields,
    signatoryName: input.template.signatoryName,
    issuedDate: input.issuedDate,
    token: input.token,
    showSeal: input.template.sections.some((s) => s.type === "seal" && s.show),
    schoolName: input.resolved["school.name"],
    schoolAddress: input.resolved["school.address"],
    schoolContact: input.resolved["school.contact"],
  };
}

export function buildIdCardRecord(input: {
  id: string;
  cardNumber?: string;
  subjectType: "student" | "staff";
  holderName: string;
  subtitle: string;
  style: DocumentTemplateDto["style"];
  expiryDate: string;
  issueDate?: string;
  status: "issued" | "cancelled";
  resolved: Record<string, string>;
}): IdCardRecordDto {
  const extra: Record<string, string> = {};
  if (input.resolved["student.admissionNumber"]) extra.admissionNumber = input.resolved["student.admissionNumber"];
  if (input.resolved["staff.employeeCode"]) extra.employeeId = input.resolved["staff.employeeCode"];

  return {
    id: input.id,
    cardNumber: input.cardNumber ?? "PREVIEW",
    kind: input.subjectType,
    holderName: input.holderName,
    subtitle: input.subtitle,
    photoColor: colorFor(input.holderName),
    style: input.style ?? "premium-teal",
    issueDate: input.issueDate,
    expiryDate: input.expiryDate,
    status: input.status,
    verificationToken: input.id,
    extra,
    schoolName: input.resolved["school.name"],
    schoolAddress: input.resolved["school.address"],
    schoolContact: input.resolved["school.contact"],
  };
}

export function isIdCard(docType: DocTypeDto): boolean {
  return docType === "student-id" || docType === "staff-id";
}
