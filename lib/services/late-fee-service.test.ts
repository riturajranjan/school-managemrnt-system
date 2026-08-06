import { describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { moneyFromMajor, zeroMoney } from "@/lib/finance/money";
import { calculateLateFee, createLateFeeRule, recalculateLateFees, setLateFeeRuleStatus, updateLateFeeRule, waiveFine } from "./late-fee-service";
import type { LateFeeRule, StudentFeeItem } from "@/lib/types/fees";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };
const TODAY = new Date("2026-08-05T00:00:00.000Z");

function item(overrides: Partial<StudentFeeItem>): StudentFeeItem {
  return {
    id: "sfi-1",
    assignmentId: "sfa-1",
    studentId: "student-1",
    session: "2026-2027",
    structureId: "fs-1",
    componentId: "fc-1",
    componentType: "tuition",
    label: "Tuition",
    billedAmount: moneyFromMajor(1000, "INR"),
    discountAmount: zeroMoney("INR"),
    scholarshipAmount: zeroMoney("INR"),
    fineAmount: zeroMoney("INR"),
    paidAmount: zeroMoney("INR"),
    dueDate: "2026-07-01",
    status: "overdue",
    refundable: false,
    ...overrides,
  };
}

function rule(overrides: Partial<LateFeeRule> = {}): LateFeeRule {
  return {
    id: "lfr-1",
    name: "Test rule",
    calcType: "fixed",
    amount: moneyFromMajor(200, "INR"),
    gracePeriodDays: 10,
    applicableComponentIds: [],
    applicableClassIds: [],
    status: "active",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("calculateLateFee", () => {
  it("returns zero for an item that isn't overdue", () => {
    expect(calculateLateFee(rule(), item({ status: "pending" }), TODAY).minorUnits).toBe(0);
  });

  it("returns zero while still within the grace period", () => {
    const recentlyOverdue = item({ dueDate: "2026-07-30" }); // 6 days overdue, grace = 10
    expect(calculateLateFee(rule({ gracePeriodDays: 10 }), recentlyOverdue, TODAY).minorUnits).toBe(0);
  });

  it("applies a fixed fine once past the grace period", () => {
    const overdue = item({ dueDate: "2026-07-01" }); // 35 days overdue
    const fine = calculateLateFee(rule({ calcType: "fixed", amount: moneyFromMajor(200, "INR"), gracePeriodDays: 10 }), overdue, TODAY);
    expect(fine.minorUnits).toBe(moneyFromMajor(200, "INR").minorUnits);
  });

  it("computes a percentage fine off the net due amount", () => {
    const overdue = item({ dueDate: "2026-07-01", billedAmount: moneyFromMajor(1000, "INR") });
    const fine = calculateLateFee(rule({ calcType: "percentage", percent: 10, gracePeriodDays: 10 }), overdue, TODAY);
    expect(fine.minorUnits).toBe(moneyFromMajor(100, "INR").minorUnits);
  });

  it("scales a daily fine by the number of days past grace", () => {
    const overdue = item({ dueDate: "2026-07-26" }); // 10 days overdue
    const fine = calculateLateFee(rule({ calcType: "daily", amount: moneyFromMajor(10, "INR"), gracePeriodDays: 5 }), overdue, TODAY);
    expect(fine.minorUnits).toBe(moneyFromMajor(50, "INR").minorUnits); // 5 days past grace * 10
  });

  it("picks the matching slab for a slab-based rule", () => {
    const overdue = item({ dueDate: "2026-07-01" }); // 35 days overdue, grace 0
    const slabRule = rule({
      calcType: "slab",
      gracePeriodDays: 0,
      slabs: [
        { fromDay: 0, toDay: 15, amount: moneyFromMajor(100, "INR") },
        { fromDay: 16, toDay: 45, amount: moneyFromMajor(300, "INR") },
        { fromDay: 46, amount: moneyFromMajor(500, "INR") },
      ],
    });
    const fine = calculateLateFee(slabRule, overdue, TODAY);
    expect(fine.minorUnits).toBe(moneyFromMajor(300, "INR").minorUnits);
  });

  it("caps the fine at maxCapAmount", () => {
    const overdue = item({ dueDate: "2026-05-01" }); // ~96 days overdue
    const fine = calculateLateFee(rule({ calcType: "daily", amount: moneyFromMajor(50, "INR"), gracePeriodDays: 0, maxCapAmount: moneyFromMajor(1000, "INR") }), overdue, TODAY);
    expect(fine.minorUnits).toBe(moneyFromMajor(1000, "INR").minorUnits);
  });
});

describe("createLateFeeRule / updateLateFeeRule / setLateFeeRuleStatus", () => {
  it("creates an active rule", () => {
    resetDemoData();
    const created = createLateFeeRule({ name: "New rule", calcType: "fixed", amount: moneyFromMajor(150, "INR"), gracePeriodDays: 5, applicableComponentIds: [], applicableClassIds: [] }, ACTOR);
    expect(created.status).toBe("active");
    expect(getSnapshot().lateFeeRules.some((r) => r.id === created.id)).toBe(true);
  });

  it("updates only the targeted rule", () => {
    resetDemoData();
    const created = createLateFeeRule({ name: "To Rename", calcType: "fixed", amount: moneyFromMajor(150, "INR"), gracePeriodDays: 5, applicableComponentIds: [], applicableClassIds: [] }, ACTOR);
    updateLateFeeRule(created.id, { name: "Renamed" }, ACTOR);
    expect(getSnapshot().lateFeeRules.find((r) => r.id === created.id)?.name).toBe("Renamed");
  });

  it("toggles a rule's status", () => {
    resetDemoData();
    const created = createLateFeeRule({ name: "To Deactivate", calcType: "fixed", amount: moneyFromMajor(150, "INR"), gracePeriodDays: 5, applicableComponentIds: [], applicableClassIds: [] }, ACTOR);
    setLateFeeRuleStatus(created.id, "inactive", ACTOR);
    expect(getSnapshot().lateFeeRules.find((r) => r.id === created.id)?.status).toBe("inactive");
  });
});

describe("recalculateLateFees (seed data)", () => {
  it("only ever updates overdue items, never pending or paid ones", () => {
    resetDemoData();
    const before = getSnapshot().studentFeeItems.filter((i) => i.status !== "overdue").map((i) => ({ id: i.id, fine: i.fineAmount.minorUnits }));
    recalculateLateFees(ACTOR);
    const after = getSnapshot().studentFeeItems.filter((i) => i.status !== "overdue").map((i) => ({ id: i.id, fine: i.fineAmount.minorUnits }));
    expect(after).toEqual(before);
  });

  it("is idempotent — running it twice in a row produces the same fines", () => {
    resetDemoData();
    recalculateLateFees(ACTOR);
    const afterFirst = getSnapshot().studentFeeItems.filter((i) => i.status === "overdue").map((i) => i.fineAmount.minorUnits);
    const result = recalculateLateFees(ACTOR);
    const afterSecond = getSnapshot().studentFeeItems.filter((i) => i.status === "overdue").map((i) => i.fineAmount.minorUnits);
    expect(afterSecond).toEqual(afterFirst);
    expect(result.updated).toBe(0);
  });
});

describe("waiveFine", () => {
  it("fully waives a fine when no partial amount is given", () => {
    resetDemoData();
    recalculateLateFees(ACTOR);
    const withFine = getSnapshot().studentFeeItems.find((i) => i.fineAmount.minorUnits > 0);
    if (!withFine) return;
    const result = waiveFine(withFine.id, undefined, "Goodwill waiver", ACTOR);
    expect(result.ok).toBe(true);
    const after = getSnapshot().studentFeeItems.find((i) => i.id === withFine.id)!;
    expect(after.fineAmount.minorUnits).toBe(0);
  });

  it("partially waives when a smaller amount is given", () => {
    resetDemoData();
    recalculateLateFees(ACTOR);
    const withFine = getSnapshot().studentFeeItems.find((i) => i.fineAmount.minorUnits >= 100);
    if (!withFine) return;
    const partial = { minorUnits: 50, currency: "INR" as const };
    waiveFine(withFine.id, partial, "Partial waiver", ACTOR);
    const after = getSnapshot().studentFeeItems.find((i) => i.id === withFine.id)!;
    expect(after.fineAmount.minorUnits).toBe(withFine.fineAmount.minorUnits - 50);
  });

  it("refuses to waive an item with no fine", () => {
    resetDemoData();
    const noFine = getSnapshot().studentFeeItems.find((i) => i.fineAmount.minorUnits === 0);
    if (!noFine) return;
    const result = waiveFine(noFine.id, undefined, "reason", ACTOR);
    expect(result.ok).toBe(false);
  });
});
