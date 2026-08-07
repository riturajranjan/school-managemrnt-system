import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { adjustStock, createItem, issueStock, receiveStock, returnIssue, transferStock } from "./inventory-service";
import { moneyFromMajor } from "@/lib/finance/money";

const ACTOR = { name: "Storekeeper", role: "Storekeeper" };

function makeItem(qty = 100) {
  const r = createItem(
    { branch: "main", name: "Test Item", sku: `SKU-${Math.random().toString(36).slice(2, 8)}`, categoryId: "invcat-1", unit: "piece", minimumLevel: 10, reorderLevel: 20, maximumLevel: 500, unitCost: moneyFromMajor(50, "INR"), taxPercent: 18, openingQuantity: qty },
    ACTOR,
  );
  if (!r.ok || !r.item) throw new Error("item create failed");
  return r.item;
}

describe("inventory movement ledger", () => {
  beforeEach(() => resetDemoData());

  it("creates an item with an opening-stock movement", () => {
    const item = makeItem(100);
    const movements = getSnapshot().inventoryMovements.filter((m) => m.itemId === item.id);
    expect(movements).toHaveLength(1);
    expect(movements[0].balanceAfter).toBe(100);
  });

  it("keeps quantity equal to the sum of movement deltas", () => {
    const item = makeItem(100);
    receiveStock(item.id, 50, ACTOR);
    issueStock({ itemId: item.id, quantity: 30, recipientType: "classroom", recipientName: "VI-A", returnable: false }, ACTOR);
    const db = getSnapshot();
    const deltas = db.inventoryMovements.filter((m) => m.itemId === item.id).reduce((s, m) => s + m.quantityDelta, 0);
    expect(db.inventoryItems.find((i) => i.id === item.id)?.quantity).toBe(deltas);
    expect(deltas).toBe(120);
  });

  it("prevents issuing more than is in stock (no negative stock)", () => {
    const item = makeItem(10);
    const result = issueStock({ itemId: item.id, quantity: 25, recipientType: "department", recipientName: "Science", returnable: false }, ACTOR);
    expect(result.ok).toBe(false);
    expect(getSnapshot().inventoryItems.find((i) => i.id === item.id)?.quantity).toBe(10);
  });

  it("prevents a write-off/adjustment from driving stock negative", () => {
    const item = makeItem(5);
    expect(adjustStock(item.id, -10, ACTOR, "correction").ok).toBe(false);
  });

  it("recomputes status to low-stock at the reorder threshold", () => {
    const item = makeItem(100);
    issueStock({ itemId: item.id, quantity: 85, recipientType: "classroom", recipientName: "VI-A", returnable: false }, ACTOR);
    expect(getSnapshot().inventoryItems.find((i) => i.id === item.id)?.status).toBe("low-stock");
  });
});

describe("issue and return", () => {
  beforeEach(() => resetDemoData());

  it("restocks a good-condition return but not a lost one", () => {
    const item = makeItem(50);
    const issue = issueStock({ itemId: item.id, quantity: 10, recipientType: "department", recipientName: "PE", returnable: true }, ACTOR);
    if (!issue.ok || !issue.issue) throw new Error("issue failed");
    expect(getSnapshot().inventoryItems.find((i) => i.id === item.id)?.quantity).toBe(40);
    returnIssue(issue.issue.id, 6, ACTOR, "good");
    expect(getSnapshot().inventoryItems.find((i) => i.id === item.id)?.quantity).toBe(46);
    returnIssue(issue.issue.id, 4, ACTOR, "lost");
    // lost items are not restocked
    expect(getSnapshot().inventoryItems.find((i) => i.id === item.id)?.quantity).toBe(46);
    expect(getSnapshot().inventoryIssues.find((i) => i.id === issue.issue!.id)?.status).toBe("returned");
  });
});

describe("transfer", () => {
  beforeEach(() => resetDemoData());

  it("keeps net quantity unchanged and records a balanced out/in pair", () => {
    const item = makeItem(60);
    transferStock(item.id, 20, "Store A", "Store B", ACTOR);
    const db = getSnapshot();
    expect(db.inventoryItems.find((i) => i.id === item.id)?.quantity).toBe(60);
    const mvs = db.inventoryMovements.filter((m) => m.itemId === item.id && (m.type === "transfer-in" || m.type === "transfer-out"));
    expect(mvs).toHaveLength(2);
  });
});
