import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import {
  generateDocument,
  setBatchStatus,
  updatePrintItem,
  validateTemplate,
  verifyToken,
} from "./documents-service";

describe("template validation", () => {
  beforeEach(() => resetDemoData());

  it("flags a certificate template missing a document number", () => {
    const tpl = getSnapshot().documentTemplates.find((t) => t.kind === "student-certificate")!;
    const broken = { ...tpl, sections: tpl.sections.map((s) => (s.type === "document-number" ? { ...s, show: false } : s)) };
    const issues = validateTemplate(broken);
    expect(issues.some((i) => i.level === "error")).toBe(true);
  });

  it("passes a well-formed certificate template", () => {
    const tpl = getSnapshot().documentTemplates.find((t) => t.id === "tpl-bonafide")!;
    expect(validateTemplate(tpl).filter((i) => i.level === "error")).toHaveLength(0);
  });
});

describe("document generation", () => {
  beforeEach(() => resetDemoData());

  it("generates a document, advances the numbering sequence and increments usage", () => {
    const tpl = getSnapshot().documentTemplates.find((t) => t.id === "tpl-bonafide")!;
    const rule = getSnapshot().documentNumberingRules.find((r) => r.id === tpl.numberingRuleId)!;
    const seqBefore = rule.nextSequence;
    const usageBefore = tpl.usageCount;
    const student = getSnapshot().students.find((s) => s.status === "active")!;
    const result = generateDocument({
      type: "bonafide-certificate",
      template: tpl,
      recipient: { id: "r1", type: "student", refId: student.id, name: "Test Student", subtitle: "Class 5" },
      fields: { studentName: "Test Student" },
      generatedBy: "Tester",
    });
    expect(result.ok).toBe(true);
    const db = getSnapshot();
    expect(db.documentNumberingRules.find((r) => r.id === rule.id)!.nextSequence).toBe(seqBefore + 1);
    expect(db.documentTemplates.find((t) => t.id === tpl.id)!.usageCount).toBe(usageBefore + 1);
  });

  it("adds to the print queue when requested", () => {
    const tpl = getSnapshot().documentTemplates.find((t) => t.id === "tpl-bonafide")!;
    const student = getSnapshot().students.find((s) => s.status === "active")!;
    const qBefore = getSnapshot().printQueue.length;
    generateDocument({ type: "bonafide-certificate", template: tpl, recipient: { id: "r1", type: "student", refId: student.id, name: "Test", subtitle: "5" }, fields: {}, generatedBy: "T", addToQueue: true });
    expect(getSnapshot().printQueue.length).toBe(qBefore + 1);
  });
});

describe("batch completion guard", () => {
  beforeEach(() => resetDemoData());

  it("refuses to complete a batch with missing/failed records", () => {
    const batch = getSnapshot().documentBatches.find((b) => b.missing > 0 || b.failed > 0);
    if (batch) expect(setBatchStatus(batch.id, "completed").ok).toBe(false);
  });
});

describe("print queue", () => {
  beforeEach(() => resetDemoData());

  it("rejects zero copies", () => {
    const item = getSnapshot().printQueue[0];
    expect(updatePrintItem(item.id, { copies: 0 }).ok).toBe(false);
  });
});

describe("verification (opaque token → permitted fields only)", () => {
  beforeEach(() => resetDemoData());

  it("rejects a non-token string", () => {
    expect(verifyToken("hello").state).toBe("invalid-token");
  });

  it("returns not-found for a well-formed but unknown token", () => {
    expect(verifyToken("NVX-ZZZZZZZZ").state).toBe("not-found");
  });

  it("verifies a real document token and increments the verify count", () => {
    const doc = getSnapshot().generatedDocuments.find((d) => d.status !== "revoked" && d.status !== "replaced" && d.status !== "expired")!;
    const before = doc.verifyCount;
    const result = verifyToken(doc.verificationToken);
    expect(result.state).toBe("valid");
    expect(result.record?.recipientName).toBe(doc.recipient.name);
    expect(getSnapshot().generatedDocuments.find((d) => d.id === doc.id)!.verifyCount).toBe(before + 1);
  });
});
