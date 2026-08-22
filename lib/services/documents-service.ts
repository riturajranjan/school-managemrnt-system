import { getSnapshot, setState } from "@/lib/data/store";
import type {
  DocumentRecipient,
  DocumentTemplate,
  DocumentType,
  GeneratedDocument,
  IdCardStatus,
  PrintLayout,
  PrintQueueItem,
  PrintStatus,
  VerificationRecord,
  VerificationState,
} from "@/lib/types/documents";
import { generateId } from "@/lib/utils";

type Result = { ok: true } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Numbering — builds the next document number from a rule and advances it.
// Frontend-only sequence; no persistence guarantees.
// ---------------------------------------------------------------------------

export function previewNumber(ruleId: string): string {
  const rule = getSnapshot().documentNumberingRules.find((r) => r.id === ruleId);
  if (!rule) return "—";
  return formatNumber(rule.prefix, rule.includeYear, rule.branchCode, rule.separator, rule.sequenceLength, rule.nextSequence);
}

export function formatNumber(prefix: string, includeYear: boolean, branchCode: string | undefined, separator: string, len: number, seq: number): string {
  const parts = [prefix];
  if (includeYear) parts.push("2026");
  if (branchCode) parts.push(branchCode);
  parts.push(String(seq).padStart(len, "0"));
  return parts.join(separator);
}

function nextNumberForType(type: DocumentType): { number: string; ruleId?: string } {
  const db = getSnapshot();
  const rule = db.documentNumberingRules.find((r) => r.docTypes.includes(type));
  if (!rule) return { number: `DOC/2026/${String(db.generatedDocuments.length + 1).padStart(4, "0")}` };
  return { number: formatNumber(rule.prefix, rule.includeYear, rule.branchCode, rule.separator, rule.sequenceLength, rule.nextSequence), ruleId: rule.id };
}

function makeToken() { return `NVX-${Math.abs(Math.floor(new Date().getTime() * Math.random())).toString(36).toUpperCase().slice(0, 8)}`; }

// ---------------------------------------------------------------------------
// Template validation — pure, returns issues an author must fix before use.
// ---------------------------------------------------------------------------

export type TemplateIssue = { level: "error" | "warning"; message: string };

export function validateTemplate(template: DocumentTemplate): TemplateIssue[] {
  const issues: TemplateIssue[] = [];
  const shown = template.sections.filter((s) => s.show);
  const has = (t: string) => shown.some((s) => s.type === t);
  if (!has("school-name") && !has("logo")) issues.push({ level: "error", message: "Missing school logo and name — add at least one branding section." });
  if ((template.kind === "student-certificate" || template.kind === "staff-certificate") && !has("document-number")) issues.push({ level: "error", message: "Certificates require a document number section." });
  if ((template.kind === "student-certificate" || template.kind === "letter") && !has("signature")) issues.push({ level: "warning", message: "No signatory section — signature line will be blank." });
  if (template.kind === "id-card" && !has("photo")) issues.push({ level: "warning", message: "ID card has no photo section." });
  if (template.kind === "id-card" && !has("qr")) issues.push({ level: "warning", message: "ID card has no QR placeholder — verification will be unavailable." });
  if (shown.length === 0) issues.push({ level: "error", message: "Template has no visible sections." });
  return issues;
}

// Per-recipient readiness check used before generating.
export type RecipientReadiness = { ready: boolean; issue?: string };

export function checkRecipient(type: DocumentType, recipient: DocumentRecipient): RecipientReadiness {
  const db = getSnapshot();
  if (recipient.type === "student") {
    const s = db.students.find((x) => x.id === recipient.refId);
    if (!s) return { ready: false, issue: "Student not found" };
    if (!s.admissionNumber) return { ready: false, issue: "Missing admission number" };
  }
  return { ready: true };
}

// ---------------------------------------------------------------------------
// Generate a single document (simulation).
// ---------------------------------------------------------------------------

export function generateDocument(input: { type: DocumentType; template: DocumentTemplate; recipient: DocumentRecipient; fields: Record<string, string>; generatedBy: string; addToQueue?: boolean }): Result & { documentId?: string } {
  const readiness = checkRecipient(input.type, input.recipient);
  if (!readiness.ready) return { ok: false, error: readiness.issue ?? "Recipient is not ready." };
  const templateIssues = validateTemplate(input.template).filter((i) => i.level === "error");
  if (templateIssues.length > 0) return { ok: false, error: templateIssues[0].message };

  const { number, ruleId } = nextNumberForType(input.type);
  const now = new Date().toISOString();
  const doc: GeneratedDocument = {
    id: generateId("doc"),
    number,
    type: input.type,
    kind: input.template.kind,
    templateId: input.template.id,
    templateName: input.template.name,
    recipient: input.recipient,
    status: "generated",
    paperSize: input.template.paperSize,
    generatedAt: now,
    generatedBy: input.generatedBy,
    version: 1,
    printCount: 0,
    verifyCount: 0,
    verificationToken: makeToken(),
    signatoryName: input.template.signatoryId ? getSnapshot().signatoryProfiles.find((s) => s.id === input.template.signatoryId)?.name : undefined,
    fields: input.fields,
  };
  setState((db) => ({
    ...db,
    generatedDocuments: [doc, ...db.generatedDocuments],
    documentVersions: [{ id: generateId("ver"), documentId: doc.id, version: 1, label: "Generated", at: now, by: input.generatedBy }, ...db.documentVersions],
    documentTemplates: db.documentTemplates.map((t) => (t.id === input.template.id ? { ...t, usageCount: t.usageCount + 1 } : t)),
    documentNumberingRules: ruleId ? db.documentNumberingRules.map((r) => (r.id === ruleId ? { ...r, nextSequence: r.nextSequence + 1 } : r)) : db.documentNumberingRules,
    printQueue: input.addToQueue ? [{ id: generateId("pq"), documentNumber: doc.number, documentType: doc.type, owner: doc.recipient.name, pages: doc.paperSize === "cr80" ? 1 : 1, copies: 1, paperSize: doc.paperSize, printer: "Default", layout: (doc.paperSize === "cr80" ? "id-sheet" : doc.kind === "receipt" ? "thermal" : "one-per-page") as PrintLayout, addedBy: input.generatedBy, addedAt: now, status: "queued" as PrintStatus }, ...db.printQueue] : db.printQueue,
  }));
  return { ok: true, documentId: doc.id };
}

export function reprintDocument(documentId: string, by: string): Result {
  const db = getSnapshot();
  const doc = db.generatedDocuments.find((d) => d.id === documentId);
  if (!doc) return { ok: false, error: "Document not found." };
  const now = new Date().toISOString();
  setState((current) => ({
    ...current,
    generatedDocuments: current.generatedDocuments.map((d) => (d.id === documentId ? { ...d, printCount: d.printCount + 1 } : d)),
    printQueue: [{ id: generateId("pq"), documentNumber: doc.number, documentType: doc.type, owner: doc.recipient.name, pages: 1, copies: 1, paperSize: doc.paperSize, printer: "Default", layout: (doc.paperSize === "cr80" ? "id-sheet" : "one-per-page") as PrintLayout, addedBy: by, addedAt: now, status: "queued" }, ...current.printQueue],
  }));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// ID cards
// ---------------------------------------------------------------------------

export function setIdCardStatus(cardId: string, status: IdCardStatus): Result {
  const now = new Date().toISOString().slice(0, 10);
  setState((db) => ({ ...db, idCards: db.idCards.map((c) => (c.id === cardId ? { ...c, status, issueDate: status === "issued" && !c.issueDate ? now : c.issueDate } : c)) }));
  return { ok: true };
}

export function reissueIdCard(cardId: string): Result {
  const db = getSnapshot();
  const card = db.idCards.find((c) => c.id === cardId);
  if (!card) return { ok: false, error: "Card not found." };
  setState((current) => ({ ...current, idCards: current.idCards.map((c) => (c.id === cardId ? { ...c, status: "replaced" } : c)) }));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Batch (simulation) — validation prevents "success" on invalid records.
// ---------------------------------------------------------------------------

export function setBatchStatus(batchId: string, status: "running" | "paused" | "completed" | "cancelled" | "ready"): Result {
  const db = getSnapshot();
  const batch = db.documentBatches.find((b) => b.id === batchId);
  if (!batch) return { ok: false, error: "Batch not found." };
  if (status === "completed" && (batch.missing > 0 || batch.failed > 0)) {
    return { ok: false, error: `Cannot complete: ${batch.missing} missing and ${batch.failed} failed record(s) must be resolved first.` };
  }
  setState((current) => ({ ...current, documentBatches: current.documentBatches.map((b) => (b.id === batchId ? { ...b, status } : b)) }));
  return { ok: true };
}

/** Retries failed/missing items — moves resolvable ones to ready (simulation). */
export function retryBatchFailures(batchId: string): Result {
  const db = getSnapshot();
  const items = db.documentBatchItems.filter((i) => i.batchId === batchId);
  setState((current) => {
    const updatedItems = current.documentBatchItems.map((i) => (i.batchId === batchId && i.status === "failed" ? { ...i, status: "ready" as const, issue: undefined } : i));
    const ready = updatedItems.filter((i) => i.batchId === batchId && (i.status === "ready" || i.status === "generated")).length;
    const missing = updatedItems.filter((i) => i.batchId === batchId && i.status === "missing-info").length;
    return {
      ...current,
      documentBatchItems: updatedItems,
      documentBatches: current.documentBatches.map((b) => (b.id === batchId ? { ...b, ready, missing, failed: 0 } : b)),
    };
  });
  void items;
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Print queue
// ---------------------------------------------------------------------------

export function setPrintStatus(itemId: string, status: PrintStatus): Result {
  setState((db) => ({ ...db, printQueue: db.printQueue.map((p) => (p.id === itemId ? { ...p, status } : p)) }));
  return { ok: true };
}

export function updatePrintItem(itemId: string, patch: Partial<Pick<PrintQueueItem, "copies" | "layout">>): Result {
  if (patch.copies != null && patch.copies < 1) return { ok: false, error: "Copies must be at least 1." };
  setState((db) => ({ ...db, printQueue: db.printQueue.map((p) => (p.id === itemId ? { ...p, ...patch } : p)) }));
  return { ok: true };
}

export function removePrintItem(itemId: string): Result {
  setState((db) => ({ ...db, printQueue: db.printQueue.filter((p) => p.id !== itemId) }));
  return { ok: true };
}

export function clearPrintedJobs(): Result {
  setState((db) => ({ ...db, printQueue: db.printQueue.filter((p) => p.status !== "printed") }));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Verification (mock) — resolves an opaque token to a permitted-fields result.
// Never returns medical info, addresses or phone numbers.
// ---------------------------------------------------------------------------

export type VerificationResult = { state: VerificationState; record?: { documentNumber: string; type: DocumentType; recipientName: string; issuedDate: string } };

export function verifyToken(rawToken: string): VerificationResult {
  const db = getSnapshot();
  const t = rawToken.trim().toUpperCase();
  if (!t || !t.startsWith("NVX-")) return { state: "invalid-token" };
  const doc = db.generatedDocuments.find((d) => d.verificationToken.toUpperCase() === t);
  const card = db.idCards.find((c) => c.verificationToken.toUpperCase() === t);
  if (!doc && !card) return { state: "not-found" };
  if (doc) {
    // Record the verification check (increments count).
    const rec: VerificationRecord = { id: generateId("vr"), token: doc.verificationToken, documentNumber: doc.number, documentType: doc.type, recipientName: doc.recipient.name, issuedDate: doc.issuedDate ?? doc.generatedAt, state: doc.status === "revoked" ? "revoked" : doc.status === "replaced" ? "replaced" : doc.status === "expired" ? "expired" : "valid", checkedAt: new Date().toISOString() };
    setState((current) => ({ ...current, generatedDocuments: current.generatedDocuments.map((d) => (d.id === doc.id ? { ...d, verifyCount: d.verifyCount + 1 } : d)), verificationRecords: [rec, ...current.verificationRecords] }));
    return { state: rec.state, record: { documentNumber: doc.number, type: doc.type, recipientName: doc.recipient.name, issuedDate: (doc.issuedDate ?? doc.generatedAt).slice(0, 10) } };
  }
  // ID card path (returns only card number, holder name, issue date).
  const c = card!;
  const state: VerificationState = c.status === "cancelled" ? "revoked" : c.status === "replaced" ? "replaced" : c.status === "expired" ? "expired" : "valid";
  return { state, record: { documentNumber: c.cardNumber, type: c.kind === "staff" ? "staff-id" : "student-id", recipientName: c.holderName, issuedDate: (c.issueDate ?? "").slice(0, 10) } };
}
