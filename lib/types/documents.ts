import type { ID, StatusTone } from "./common";

// ===========================================================================
// Phase 12 — Document Studio: templates, generated documents, ID cards,
// certificates, letters, admit cards, receipts, batches, print queue and QR
// verification. Frontend mock models only.
//
// No real PDF generation, no real QR/token verification backend, no digital
// signatures, no storage. QR/barcode glyphs encode an OPAQUE token only — never
// personal data. Certificates/letters/admit-cards/receipts are unified under
// GeneratedDocument + DocumentTemplate(kind) so one preview/print pipeline
// serves them all (rather than a separate model class per document type).
// ===========================================================================

// The high-level family a template/document belongs to.
export type DocumentKind =
  | "id-card"
  | "student-certificate"
  | "staff-certificate"
  | "activity-certificate"
  | "letter"
  | "admit-card"
  | "receipt"
  | "report-document"
  | "visitor-badge"
  | "custom";

export const documentKindLabels: Record<DocumentKind, string> = {
  "id-card": "ID Card",
  "student-certificate": "Student Certificate",
  "staff-certificate": "Staff Certificate",
  "activity-certificate": "Activity Certificate",
  letter: "Letter",
  "admit-card": "Admit Card",
  receipt: "Receipt",
  "report-document": "Report Document",
  "visitor-badge": "Visitor Badge",
  custom: "Custom",
};

// The specific document type (drives which fields a form/preview shows).
export type DocumentType =
  | "student-id"
  | "staff-id"
  | "library-card"
  | "transport-card"
  | "hostel-card"
  | "visitor-badge"
  | "transfer-certificate"
  | "bonafide-certificate"
  | "character-certificate"
  | "study-certificate"
  | "attendance-certificate"
  | "school-leaving-certificate"
  | "conduct-certificate"
  | "migration-certificate"
  | "achievement-certificate"
  | "participation-certificate"
  | "sports-certificate"
  | "offer-letter"
  | "appointment-letter"
  | "confirmation-letter"
  | "promotion-letter"
  | "transfer-letter"
  | "experience-letter"
  | "relieving-letter"
  | "salary-certificate"
  | "employment-certificate"
  | "training-certificate"
  | "recommendation-letter"
  | "warning-letter"
  | "admit-card"
  | "fee-receipt"
  | "fee-statement"
  | "refund-receipt"
  | "scholarship-statement"
  | "payment-summary"
  | "custom-document";

export const documentTypeLabels: Record<DocumentType, string> = {
  "student-id": "Student ID Card",
  "staff-id": "Staff ID Card",
  "library-card": "Library Card",
  "transport-card": "Transport Card",
  "hostel-card": "Hostel Card",
  "visitor-badge": "Visitor Badge",
  "transfer-certificate": "Transfer Certificate",
  "bonafide-certificate": "Bonafide Certificate",
  "character-certificate": "Character Certificate",
  "study-certificate": "Study Certificate",
  "attendance-certificate": "Attendance Certificate",
  "school-leaving-certificate": "School Leaving Certificate",
  "conduct-certificate": "Conduct Certificate",
  "migration-certificate": "Migration Certificate",
  "achievement-certificate": "Achievement Certificate",
  "participation-certificate": "Participation Certificate",
  "sports-certificate": "Sports Certificate",
  "offer-letter": "Offer Letter",
  "appointment-letter": "Appointment Letter",
  "confirmation-letter": "Confirmation Letter",
  "promotion-letter": "Promotion Letter",
  "transfer-letter": "Transfer Letter",
  "experience-letter": "Experience Letter",
  "relieving-letter": "Relieving Letter",
  "salary-certificate": "Salary Certificate",
  "employment-certificate": "Employment Certificate",
  "training-certificate": "Training Certificate",
  "recommendation-letter": "Recommendation Letter",
  "warning-letter": "Warning Letter",
  "admit-card": "Exam Admit Card",
  "fee-receipt": "Fee Receipt",
  "fee-statement": "Fee Statement",
  "refund-receipt": "Refund Receipt",
  "scholarship-statement": "Scholarship Statement",
  "payment-summary": "Payment Summary",
  "custom-document": "Custom Document",
};

export type PaperSize = "cr80" | "a4" | "a5" | "letter" | "legal" | "cert-portrait" | "cert-landscape" | "thermal" | "custom-card";

export const paperSizeLabels: Record<PaperSize, string> = {
  cr80: "CR80 ID card",
  a4: "A4",
  a5: "A5",
  letter: "Letter",
  legal: "Legal",
  "cert-portrait": "Certificate (portrait)",
  "cert-landscape": "Certificate (landscape)",
  thermal: "Thermal receipt",
  "custom-card": "Custom card",
};

// Aspect ratios (width / height) for exact print previews.
export const paperAspect: Record<PaperSize, number> = {
  cr80: 1013 / 638, // 85.6 × 54 mm
  a4: 210 / 297,
  a5: 148 / 210,
  letter: 8.5 / 11,
  legal: 8.5 / 14,
  "cert-portrait": 210 / 297,
  "cert-landscape": 297 / 210,
  thermal: 80 / 200,
  "custom-card": 54 / 86,
};

export type Orientation = "portrait" | "landscape";

// -------------------------------------------------------------------------
// Templates
// -------------------------------------------------------------------------

export type TemplateSectionType =
  | "logo" | "school-name" | "address" | "contact" | "photo" | "name" | "admission-number"
  | "employee-id" | "class" | "section" | "dob" | "guardian" | "blood-group" | "validity"
  | "qr" | "signature" | "seal" | "document-number" | "custom-text" | "footer" | "body" | "subject" | "recipient";

export const sectionTypeLabels: Record<TemplateSectionType, string> = {
  logo: "School logo", "school-name": "School name", address: "Address", contact: "Contact",
  photo: "Photo", name: "Name", "admission-number": "Admission number", "employee-id": "Employee ID",
  class: "Class", section: "Section", dob: "Date of birth", guardian: "Guardian", "blood-group": "Blood group",
  validity: "Validity", qr: "QR placeholder", signature: "Signature", seal: "Seal",
  "document-number": "Document number", "custom-text": "Custom text", footer: "Footer",
  body: "Body", subject: "Subject", recipient: "Recipient",
};

export type TemplateSection = {
  id: ID;
  type: TemplateSectionType;
  label: string;
  show: boolean;
  align: "left" | "center" | "right";
  fontSize: "xs" | "sm" | "base" | "lg" | "xl";
  fontWeight: "normal" | "medium" | "semibold" | "bold";
  color?: string;
  order: number;
  customText?: string;
};

export type TemplateVariable = { key: string; label: string; sample: string };

export type DocumentTemplateStatus = "active" | "draft" | "archived";

export type DocumentTemplate = {
  id: ID;
  name: string;
  kind: DocumentKind;
  docType: DocumentType;
  paperSize: PaperSize;
  orientation: Orientation;
  accent: string; // hex accent used on the rendered doc
  style?: IdCardStyle; // set for id-card kind
  sections: TemplateSection[];
  variables: string[]; // variable keys used in this template
  signatoryId?: ID;
  numberingRuleId?: ID;
  usageCount: number;
  updatedAt: string;
  status: DocumentTemplateStatus;
  isDefault: boolean;
  thumbnailTone: StatusTone;
};

// -------------------------------------------------------------------------
// Recipients & generated documents
// -------------------------------------------------------------------------

export type RecipientType = "student" | "staff" | "visitor" | "guardian" | "other";

export type DocumentRecipient = {
  id: ID;
  type: RecipientType;
  refId?: ID; // student/employee id
  name: string;
  subtitle?: string; // class/section or designation
};

export type DocumentStatus =
  | "draft" | "generated" | "queued" | "printed" | "issued" | "expired" | "revoked" | "replaced" | "archived" | "failed";

export const documentStatusLabels: Record<DocumentStatus, string> = {
  draft: "Draft", generated: "Generated", queued: "Queued", printed: "Printed", issued: "Issued",
  expired: "Expired", revoked: "Revoked", replaced: "Replaced", archived: "Archived", failed: "Failed",
};

export const documentStatusTone: Record<DocumentStatus, StatusTone> = {
  draft: "neutral", generated: "info", queued: "warning", printed: "info", issued: "success",
  expired: "warning", revoked: "error", replaced: "neutral", archived: "neutral", failed: "error",
};

export type GeneratedDocument = {
  id: ID;
  number: string; // e.g. BON/2026/0001
  type: DocumentType;
  kind: DocumentKind;
  templateId: ID;
  templateName: string;
  recipient: DocumentRecipient;
  status: DocumentStatus;
  paperSize: PaperSize;
  generatedAt: string;
  generatedBy: string;
  issuedDate?: string;
  version: number;
  printCount: number;
  verifyCount: number;
  verificationToken: string; // opaque token, not personal data
  signatoryName?: string;
  /** Type-specific display fields (student name, purpose, subjects, etc.). */
  fields: Record<string, string>;
};

export type DocumentVersion = {
  id: ID;
  documentId: ID;
  version: number;
  label: string; // "Generated", "Corrected", "Reissued"
  at: string;
  by: string;
  note?: string;
};

// -------------------------------------------------------------------------
// ID cards
// -------------------------------------------------------------------------

export type IdCardKind = "student" | "staff" | "library" | "transport" | "hostel" | "visitor";

export const idCardKindLabels: Record<IdCardKind, string> = {
  student: "Student", staff: "Staff", library: "Library", transport: "Transport", hostel: "Hostel", visitor: "Visitor",
};

export type IdCardStyle = "campus-modern" | "classic-school" | "minimal-institutional" | "premium-teal" | "junior-friendly";

export const idCardStyleLabels: Record<IdCardStyle, string> = {
  "campus-modern": "Campus Modern",
  "classic-school": "Classic School",
  "minimal-institutional": "Minimal Institutional",
  "premium-teal": "Premium Teal",
  "junior-friendly": "Junior Friendly",
};

export type IdCardStatus = "not-generated" | "draft" | "generated" | "printed" | "issued" | "expired" | "replaced" | "cancelled";

export const idCardStatusLabels: Record<IdCardStatus, string> = {
  "not-generated": "Not generated", draft: "Draft", generated: "Generated", printed: "Printed",
  issued: "Issued", expired: "Expired", replaced: "Replaced", cancelled: "Cancelled",
};

export const idCardStatusTone: Record<IdCardStatus, StatusTone> = {
  "not-generated": "neutral", draft: "neutral", generated: "info", printed: "info",
  issued: "success", expired: "warning", replaced: "neutral", cancelled: "error",
};

export type IdCardRecord = {
  id: ID;
  cardNumber: string;
  kind: IdCardKind;
  holderId?: ID;
  holderName: string;
  subtitle: string; // class/section or designation/department
  photoColor: string; // avatar placeholder colour
  style: IdCardStyle;
  issueDate?: string;
  expiryDate: string;
  status: IdCardStatus;
  verificationToken: string;
  // Extra fields per kind (route/stop, building/room, member id, etc.).
  extra: Record<string, string>;
};

// -------------------------------------------------------------------------
// Batches
// -------------------------------------------------------------------------

export type BatchStatus = "draft" | "validating" | "ready" | "running" | "paused" | "completed" | "failed" | "cancelled";

export const batchStatusLabels: Record<BatchStatus, string> = {
  draft: "Draft", validating: "Validating", ready: "Ready", running: "Running", paused: "Paused",
  completed: "Completed", failed: "Failed", cancelled: "Cancelled",
};

export const batchStatusTone: Record<BatchStatus, StatusTone> = {
  draft: "neutral", validating: "info", ready: "success", running: "info", paused: "warning",
  completed: "success", failed: "error", cancelled: "neutral",
};

export type DocumentBatchItemStatus = "ready" | "missing-info" | "generated" | "failed";

export type DocumentBatchItem = {
  id: ID;
  batchId: ID;
  recipientName: string;
  recipientSubtitle: string;
  status: DocumentBatchItemStatus;
  issue?: string; // "Missing photo", "Missing admission number"
};

export type DocumentBatch = {
  id: ID;
  name: string;
  docType: DocumentType;
  templateId: ID;
  groupLabel: string; // "Class 5 - A", "All teaching staff"
  total: number;
  ready: number;
  missing: number;
  failed: number;
  estimatedPages: number;
  status: BatchStatus;
  createdAt: string;
  createdBy: string;
};

// -------------------------------------------------------------------------
// Print queue
// -------------------------------------------------------------------------

export type PrintLayout = "one-per-page" | "two-per-page" | "four-per-page" | "id-sheet" | "certificate-single" | "thermal" | "duplex-id";

export const printLayoutLabels: Record<PrintLayout, string> = {
  "one-per-page": "One per page", "two-per-page": "Two per page", "four-per-page": "Four per page",
  "id-sheet": "ID card sheet", "certificate-single": "Certificate (single)", thermal: "Thermal receipt", "duplex-id": "Duplex ID (front/back)",
};

export type PrintStatus = "queued" | "preparing" | "ready" | "printing" | "printed" | "failed" | "cancelled";

export const printStatusLabels: Record<PrintStatus, string> = {
  queued: "Queued", preparing: "Preparing", ready: "Ready", printing: "Printing", printed: "Printed", failed: "Failed", cancelled: "Cancelled",
};

export const printStatusTone: Record<PrintStatus, StatusTone> = {
  queued: "neutral", preparing: "info", ready: "success", printing: "warning", printed: "success", failed: "error", cancelled: "neutral",
};

export type PrintQueueItem = {
  id: ID;
  documentNumber: string;
  documentType: DocumentType;
  owner: string;
  pages: number;
  copies: number;
  paperSize: PaperSize;
  printer: string;
  layout: PrintLayout;
  addedBy: string;
  addedAt: string;
  status: PrintStatus;
};

// -------------------------------------------------------------------------
// Verification
// -------------------------------------------------------------------------

export type VerificationState = "valid" | "revoked" | "expired" | "replaced" | "invalid-token" | "not-found";

export const verificationStateLabels: Record<VerificationState, string> = {
  valid: "Valid", revoked: "Revoked", expired: "Expired", replaced: "Replaced", "invalid-token": "Invalid token", "not-found": "Not found",
};

export const verificationStateTone: Record<VerificationState, StatusTone> = {
  valid: "success", revoked: "error", expired: "warning", replaced: "neutral", "invalid-token": "error", "not-found": "error",
};

export type VerificationRecord = {
  id: ID;
  token: string;
  documentNumber: string;
  documentType: DocumentType;
  recipientName: string;
  issuedDate: string;
  state: VerificationState;
  checkedAt: string;
};

// -------------------------------------------------------------------------
// Settings — numbering & signatories
// -------------------------------------------------------------------------

export type DocumentNumberingRule = {
  id: ID;
  name: string;
  docTypes: DocumentType[];
  prefix: string;
  includeYear: boolean;
  branchCode?: string;
  separator: "/" | "-" | ".";
  sequenceLength: number;
  nextSequence: number;
};

export type SignatoryProfile = {
  id: ID;
  name: string;
  designation: string;
  hasSignature: boolean;
  hasSeal: boolean;
  applicableTypes: DocumentType[];
};

// -------------------------------------------------------------------------
// Document Flow stages (dashboard visual)
// -------------------------------------------------------------------------

export type FlowStage = "source" | "template" | "preview" | "generate" | "verify" | "print" | "archive";

export const flowStageLabels: Record<FlowStage, string> = {
  source: "Source Data", template: "Template", preview: "Preview", generate: "Generate",
  verify: "Verify", print: "Print / Share", archive: "Archive",
};

export const flowStageOrder: FlowStage[] = ["source", "template", "preview", "generate", "verify", "print", "archive"];
