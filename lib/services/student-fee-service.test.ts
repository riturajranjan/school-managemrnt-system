import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { addAdHocFeeItem, addManualCredit, applyConcessionToStudent, applyDiscountToStudent, applyScholarshipToStudent, removeOptionalComponent } from "./student-fee-service";
import { moneyFromMajor } from "@/lib/finance/money";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };

function pickStudentWithUnpaidItems() {
  const db = getSnapshot();
  const student = db.students.find((s) => db.studentFeeItems.some((i) => i.studentId === s.id && i.status !== "paid" && i.status !== "cancelled"));
  if (!student) return null;
  const items = db.studentFeeItems.filter((i) => i.studentId === student.id && i.status !== "paid" && i.status !== "cancelled");
  return { student, items };
}

describe("applyDiscountToStudent", () => {
  beforeEach(() => resetDemoData());

  it("creates a discount record and reduces the discountAmount on matching unpaid items", () => {
    const found = pickStudentWithUnpaidItems();
    if (!found) return;
    const { student, items } = found;
    const componentIds = [...new Set(items.map((i) => i.componentId))];

    const discount = applyDiscountToStudent({ studentId: student.id, name: "Test discount", type: "custom", percent: 10, applicableComponentIds: componentIds, session: "2026-2027" }, ACTOR);

    const after = getSnapshot();
    expect(after.discounts.some((d) => d.id === discount.id)).toBe(true);
    const affectedItems = after.studentFeeItems.filter((i) => i.studentId === student.id && componentIds.includes(i.componentId) && i.status !== "paid" && i.status !== "cancelled");
    expect(affectedItems.some((i) => i.discountAmount.minorUnits > 0)).toBe(true);
  });

  it("links the new discount into the student's active assignment", () => {
    const found = pickStudentWithUnpaidItems();
    if (!found) return;
    const { student, items } = found;
    const componentIds = [...new Set(items.map((i) => i.componentId))];
    const discount = applyDiscountToStudent({ studentId: student.id, name: "Test discount", type: "custom", percent: 5, applicableComponentIds: componentIds, session: "2026-2027" }, ACTOR);

    const assignment = getSnapshot().studentFeeAssignments.find((a) => a.studentId === student.id && a.status === "active");
    expect(assignment?.discountIds).toContain(discount.id);
  });

  it("never touches an already-paid item's discountAmount", () => {
    const db = getSnapshot();
    const paidItem = db.studentFeeItems.find((i) => i.status === "paid");
    if (!paidItem) return;
    applyDiscountToStudent({ studentId: paidItem.studentId, name: "Test", type: "custom", percent: 50, applicableComponentIds: [paidItem.componentId], session: "2026-2027" }, ACTOR);
    const after = getSnapshot().studentFeeItems.find((i) => i.id === paidItem.id)!;
    expect(after.discountAmount.minorUnits).toBe(paidItem.discountAmount.minorUnits);
  });
});

describe("applyScholarshipToStudent", () => {
  beforeEach(() => resetDemoData());

  it("writes into scholarshipAmount, not discountAmount", () => {
    const found = pickStudentWithUnpaidItems();
    if (!found) return;
    const { student, items } = found;
    const componentIds = [...new Set(items.map((i) => i.componentId))];
    applyScholarshipToStudent({ studentId: student.id, name: "Test scholarship", type: "merit", percent: 20, applicableComponentIds: componentIds, session: "2026-2027" }, ACTOR);

    const after = getSnapshot().studentFeeItems.filter((i) => i.studentId === student.id && componentIds.includes(i.componentId) && i.status !== "paid" && i.status !== "cancelled");
    expect(after.some((i) => i.scholarshipAmount.minorUnits > 0)).toBe(true);
  });
});

describe("applyConcessionToStudent", () => {
  beforeEach(() => resetDemoData());

  it("waives a fixed amount into discountAmount and records the concession with its reason", () => {
    const found = pickStudentWithUnpaidItems();
    if (!found) return;
    const { student, items } = found;
    const componentIds = [...new Set(items.map((i) => i.componentId))];
    const concession = applyConcessionToStudent({ studentId: student.id, reason: "financial-hardship", description: "Test concession", amount: moneyFromMajor(1000, "INR"), applicableComponentIds: componentIds }, ACTOR);

    const after = getSnapshot();
    expect(after.concessions.some((c) => c.id === concession.id)).toBe(true);
    const affectedItems = after.studentFeeItems.filter((i) => i.studentId === student.id && componentIds.includes(i.componentId) && i.status !== "paid" && i.status !== "cancelled");
    const totalDiscount = affectedItems.reduce((sum, i) => sum + i.discountAmount.minorUnits, 0);
    expect(totalDiscount).toBeGreaterThan(0);
  });
});

describe("addManualCredit", () => {
  beforeEach(() => resetDemoData());

  it("adds a credit balance with zero consumed amount", () => {
    const student = getSnapshot().students[0];
    const credit = addManualCredit(student.id, 500, "Goodwill credit", ACTOR);
    const after = getSnapshot();
    expect(after.creditBalances.some((c) => c.id === credit.id)).toBe(true);
    expect(credit.consumedAmount.minorUnits).toBe(0);
    expect(credit.amount.minorUnits).toBe(moneyFromMajor(500, "INR").minorUnits);
  });
});

describe("removeOptionalComponent", () => {
  beforeEach(() => resetDemoData());

  it("cancels unpaid items for the component but leaves paid ones untouched", () => {
    const db = getSnapshot();
    const transportItem = db.studentFeeItems.find((i) => i.componentType === "transport" && i.status !== "paid" && i.status !== "cancelled");
    if (!transportItem) return;
    removeOptionalComponent(transportItem.studentId, transportItem.componentId, ACTOR);
    const after = getSnapshot().studentFeeItems.find((i) => i.id === transportItem.id)!;
    expect(after.status).toBe("cancelled");
  });

  it("does nothing when there are no matching unpaid items", () => {
    const db = getSnapshot();
    const student = db.students[0];
    const countBefore = db.studentFeeItems.length;
    removeOptionalComponent(student.id, "component-that-does-not-exist", ACTOR);
    expect(getSnapshot().studentFeeItems.length).toBe(countBefore);
  });
});

describe("addAdHocFeeItem", () => {
  beforeEach(() => resetDemoData());

  it("creates a standalone pending item not tied to any structure", () => {
    const student = getSnapshot().students[0];
    const item = addAdHocFeeItem(student.id, "2026-2027", "Replacement ID card", 150, "2026-09-01", ACTOR);
    const after = getSnapshot();
    expect(after.studentFeeItems.some((i) => i.id === item.id)).toBe(true);
    expect(item.status).toBe("pending");
    expect(item.billedAmount.minorUnits).toBe(moneyFromMajor(150, "INR").minorUnits);
  });
});
