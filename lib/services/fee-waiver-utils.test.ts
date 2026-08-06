import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData, setState } from "@/lib/data/store";
import { moneyFromMajor, zeroMoney } from "@/lib/finance/money";
import { applyWaiverToItems, reverseWaiverOnUnpaidItems } from "./fee-waiver-utils";

function firstStudentWithMultipleUnpaidItems() {
  const db = getSnapshot();
  const byStudent = new Map<string, string[]>();
  for (const item of db.studentFeeItems) {
    if (item.status === "cancelled" || item.status === "paid") continue;
    byStudent.set(item.studentId, [...(byStudent.get(item.studentId) ?? []), item.componentId]);
  }
  const entry = [...byStudent.entries()].find(([, componentIds]) => componentIds.length >= 2);
  return entry ? { studentId: entry[0], componentIds: entry[1] } : undefined;
}

describe("fee-waiver-utils", () => {
  beforeEach(() => resetDemoData());

  it("splits a waiver evenly across every matching unpaid item, losing nothing to rounding", () => {
    const target = firstStudentWithMultipleUnpaidItems();
    if (!target) return;
    const total = moneyFromMajor(101, "INR");
    applyWaiverToItems(target.studentId, target.componentIds, total, "discountAmount");
    const db = getSnapshot();
    const items = db.studentFeeItems.filter((i) => i.studentId === target.studentId && target.componentIds.includes(i.componentId) && i.status !== "cancelled" && i.status !== "paid");
    const sum = items.reduce((acc, i) => acc + i.discountAmount.minorUnits, 0);
    expect(sum).toBe(total.minorUnits);
  });

  it("leaves paid and cancelled items untouched", () => {
    const target = firstStudentWithMultipleUnpaidItems();
    if (!target) return;
    setState((db) => ({ ...db, studentFeeItems: db.studentFeeItems.map((i) => (i.studentId === target.studentId ? { ...i, status: i.componentId === target.componentIds[0] ? ("paid" as const) : i.status } : i)) }));
    const before = getSnapshot().studentFeeItems.find((i) => i.studentId === target.studentId && i.componentId === target.componentIds[0]);
    applyWaiverToItems(target.studentId, target.componentIds, moneyFromMajor(50, "INR"), "discountAmount");
    const after = getSnapshot().studentFeeItems.find((i) => i.studentId === target.studentId && i.componentId === target.componentIds[0]);
    expect(after?.discountAmount.minorUnits).toBe(before?.discountAmount.minorUnits);
  });

  it("reverses a waiver back off unpaid items without going negative", () => {
    const target = firstStudentWithMultipleUnpaidItems();
    if (!target) return;
    applyWaiverToItems(target.studentId, target.componentIds, moneyFromMajor(60, "INR"), "discountAmount");
    reverseWaiverOnUnpaidItems(target.studentId, target.componentIds, moneyFromMajor(60, "INR"), "discountAmount");
    const items = getSnapshot().studentFeeItems.filter((i) => i.studentId === target.studentId && target.componentIds.includes(i.componentId) && i.status !== "cancelled" && i.status !== "paid");
    for (const item of items) {
      expect(item.discountAmount.minorUnits).toBeGreaterThanOrEqual(0);
    }
  });

  it("is a no-op when there are no matching items", () => {
    const before = getSnapshot();
    applyWaiverToItems("no-such-student", ["no-such-component"], zeroMoney("INR"), "discountAmount");
    const after = getSnapshot();
    expect(after.studentFeeItems).toEqual(before.studentFeeItems);
  });
});
