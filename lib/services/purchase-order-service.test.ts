import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { moneyFromMajor, zeroMoney } from "@/lib/finance/money";
import { advancePurchaseOrder, approvePurchaseOrder, cancelPurchaseOrder, createPurchaseOrder, purchaseOrderTotal, submitPurchaseOrder } from "./purchase-order-service";
import type { PurchaseOrderDraft } from "./purchase-order-service";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };

function draft(): PurchaseOrderDraft {
  return {
    vendorId: "vendor-1",
    items: [{ id: "poi-1", description: "Notebooks", quantity: 100, rate: moneyFromMajor(20, "INR"), taxPercent: 12 }],
    discount: zeroMoney("INR"),
    branch: "main",
  };
}

describe("purchaseOrderTotal", () => {
  it("sums line totals with tax, minus discount", () => {
    const total = purchaseOrderTotal({ items: [{ id: "poi-1", description: "Item", quantity: 10, rate: moneyFromMajor(100, "INR"), taxPercent: 10 }], discount: moneyFromMajor(50, "INR") });
    expect(total.minorUnits).toBe(moneyFromMajor(1050, "INR").minorUnits);
  });
});

describe("purchase-order lifecycle", () => {
  beforeEach(() => resetDemoData());

  it("creates a draft PO with a sequential number", () => {
    const po = createPurchaseOrder(draft(), ACTOR);
    expect(po.status).toBe("draft");
    expect(po.poNumber).toMatch(/^PO-\d{4}-\d{4}$/);
  });

  it("moves draft -> submitted -> approved -> ordered -> partially-received -> received -> invoiced -> paid", () => {
    const po = createPurchaseOrder(draft(), ACTOR);
    expect(submitPurchaseOrder(po.id, ACTOR).ok).toBe(true);
    expect(approvePurchaseOrder(po.id, ACTOR).ok).toBe(true);
    expect(getSnapshot().purchaseOrders.find((p) => p.id === po.id)?.status).toBe("approved");

    for (const expected of ["ordered", "partially-received", "received", "invoiced", "paid"] as const) {
      expect(advancePurchaseOrder(po.id, ACTOR).ok).toBe(true);
      expect(getSnapshot().purchaseOrders.find((p) => p.id === po.id)?.status).toBe(expected);
    }
    expect(advancePurchaseOrder(po.id, ACTOR).ok).toBe(false);
  });

  it("refuses to approve a PO that hasn't been submitted", () => {
    const po = createPurchaseOrder(draft(), ACTOR);
    expect(approvePurchaseOrder(po.id, ACTOR).ok).toBe(false);
  });

  it("cancels a PO and refuses to cancel it twice", () => {
    const po = createPurchaseOrder(draft(), ACTOR);
    expect(cancelPurchaseOrder(po.id, "No longer needed", ACTOR).ok).toBe(true);
    expect(getSnapshot().purchaseOrders.find((p) => p.id === po.id)?.status).toBe("cancelled");
    expect(cancelPurchaseOrder(po.id, "Again", ACTOR).ok).toBe(false);
  });
});
