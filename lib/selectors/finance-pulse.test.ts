import { describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { addMoney } from "@/lib/finance/money";
import { netDueForItem } from "./fee-item-insights";
import { computeFinancePulse } from "./finance-pulse";

describe("computeFinancePulse", () => {
  it("produces a score within [0, 100] from four weighted, non-decorative components", () => {
    resetDemoData();
    const db = getSnapshot();
    const pulse = computeFinancePulse(db);
    expect(pulse.score).toBeGreaterThanOrEqual(0);
    expect(pulse.score).toBeLessThanOrEqual(100);
    expect(pulse.components).toHaveLength(4);
    for (const component of pulse.components) {
      expect(component.value).toBeGreaterThanOrEqual(0);
      expect(component.value).toBeLessThanOrEqual(100);
    }
    const totalWeight = pulse.components.reduce((sum, c) => sum + c.weight, 0);
    expect(totalWeight).toBeCloseTo(1, 5);
  });

  it("scores collection health as perfect when every item is fully paid off", () => {
    resetDemoData();
    const db = getSnapshot();
    const noOutstandingDb = { ...db, studentFeeItems: db.studentFeeItems.map((i) => ({ ...i, status: "paid" as const, paidAmount: addMoney(netDueForItem(i), i.fineAmount) })) };
    const pulse = computeFinancePulse(noOutstandingDb);
    const collection = pulse.components.find((c) => c.key === "collection")!;
    expect(collection.value).toBe(100);
  });
});
