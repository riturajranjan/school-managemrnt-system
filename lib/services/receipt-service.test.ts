import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { addReceiptNote, cancelReceipt, reissueReceipt, simulateSendReceipt } from "./receipt-service";

const ACTOR = { name: "Priya Nair", role: "Cashier" };

describe("cancelReceipt", () => {
  beforeEach(() => resetDemoData());

  it("marks an issued receipt cancelled and records the reason", () => {
    const db = getSnapshot();
    const receipt = db.receipts.find((r) => r.status === "issued");
    if (!receipt) return;
    const result = cancelReceipt(receipt.id, "Duplicate entry", ACTOR);
    expect(result.ok).toBe(true);
    const after = getSnapshot().receipts.find((r) => r.id === receipt.id)!;
    expect(after.status).toBe("cancelled");
    expect(after.notes).toContain("Duplicate entry");
  });

  it("refuses to cancel an already-cancelled receipt", () => {
    const db = getSnapshot();
    const receipt = db.receipts.find((r) => r.status === "issued");
    if (!receipt) return;
    cancelReceipt(receipt.id, "First cancel", ACTOR);
    const result = cancelReceipt(receipt.id, "Second cancel", ACTOR);
    expect(result.ok).toBe(false);
  });

  it("returns an error for a receipt that doesn't exist", () => {
    const result = cancelReceipt("no-such-receipt", "reason", ACTOR);
    expect(result.ok).toBe(false);
  });
});

describe("reissueReceipt", () => {
  beforeEach(() => resetDemoData());

  it("creates a new receipt with a fresh number and marks the original replaced", () => {
    const db = getSnapshot();
    const original = db.receipts.find((r) => r.status === "issued");
    if (!original) return;
    const reissued = reissueReceipt(original.id, ACTOR);
    expect(reissued).toBeDefined();
    expect(reissued?.receiptNumber).not.toBe(original.receiptNumber);
    expect(reissued?.status).toBe("issued");

    const after = getSnapshot();
    const originalAfter = after.receipts.find((r) => r.id === original.id)!;
    expect(originalAfter.status).toBe("replaced");
    expect(originalAfter.supersededByReceiptId).toBe(reissued?.id);
  });

  it("carries the same total and student across the reissue", () => {
    const db = getSnapshot();
    const original = db.receipts.find((r) => r.status === "issued");
    if (!original) return;
    const reissued = reissueReceipt(original.id, ACTOR);
    expect(reissued?.total.minorUnits).toBe(original.total.minorUnits);
    expect(reissued?.studentId).toBe(original.studentId);
  });
});

describe("addReceiptNote", () => {
  beforeEach(() => resetDemoData());

  it("appends a note to the receipt", () => {
    const db = getSnapshot();
    const receipt = db.receipts[0];
    addReceiptNote(receipt.id, "Called parent to confirm", ACTOR);
    const after = getSnapshot().receipts.find((r) => r.id === receipt.id)!;
    expect(after.notes).toContain("Called parent to confirm");
  });
});

describe("simulateSendReceipt", () => {
  beforeEach(() => resetDemoData());

  it("logs a financial audit entry naming the channel, without claiming real delivery", () => {
    const db = getSnapshot();
    const receipt = db.receipts[0];
    const auditCountBefore = getSnapshot().financialAuditLog.length;
    simulateSendReceipt(receipt.id, "whatsapp", ACTOR);
    const after = getSnapshot();
    expect(after.financialAuditLog.length).toBe(auditCountBefore + 1);
    expect(after.financialAuditLog[0].summary).toContain("WhatsApp");
    expect(after.financialAuditLog[0].summary).toContain("simulated");
  });
});
