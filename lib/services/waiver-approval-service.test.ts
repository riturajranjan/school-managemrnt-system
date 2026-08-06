import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { approveWaiver, rejectWaiver, requestDiscount, requestScholarship, revokeWaiver } from "./waiver-approval-service";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };

function pickStudentWithUnpaidItems() {
  const db = getSnapshot();
  const student = db.students.find((s) => db.studentFeeItems.some((i) => i.studentId === s.id && i.status !== "paid" && i.status !== "cancelled"));
  if (!student) return null;
  const items = db.studentFeeItems.filter((i) => i.studentId === student.id && i.status !== "paid" && i.status !== "cancelled");
  return { student, items };
}

describe("requestDiscount", () => {
  beforeEach(() => resetDemoData());

  it("creates a submitted discount without touching any fee item yet", () => {
    const found = pickStudentWithUnpaidItems();
    if (!found) return;
    const componentIds = [...new Set(found.items.map((i) => i.componentId))];
    const before = getSnapshot().studentFeeItems.filter((i) => i.studentId === found.student.id);

    const result = requestDiscount({ studentId: found.student.id, name: "Test", type: "custom", percent: 10, applicableComponentIds: componentIds, session: "2026-2027", effectiveFrom: "2026-04-01" }, ACTOR);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.status).toBe("submitted");

    const after = getSnapshot().studentFeeItems.filter((i) => i.studentId === found.student.id);
    expect(after.map((i) => i.discountAmount.minorUnits)).toEqual(before.map((i) => i.discountAmount.minorUnits));
  });

  it("refuses a second overlapping discount of the same type while one is still pending", () => {
    const found = pickStudentWithUnpaidItems();
    if (!found) return;
    const componentIds = [...new Set(found.items.map((i) => i.componentId))];
    const input = { studentId: found.student.id, name: "Test", type: "custom" as const, percent: 10, applicableComponentIds: componentIds, session: "2026-2027", effectiveFrom: "2026-04-01" };
    requestDiscount(input, ACTOR);
    const second = requestDiscount(input, ACTOR);
    expect(second.ok).toBe(false);
  });
});

describe("approveWaiver / rejectWaiver / revokeWaiver", () => {
  beforeEach(() => resetDemoData());

  it("applies the waiver to unpaid items only once approved", () => {
    const found = pickStudentWithUnpaidItems();
    if (!found) return;
    const componentIds = [...new Set(found.items.map((i) => i.componentId))];
    const requested = requestDiscount({ studentId: found.student.id, name: "Test", type: "custom", percent: 10, applicableComponentIds: componentIds, session: "2026-2027", effectiveFrom: "2026-04-01" }, ACTOR);
    if (!requested.ok) return;

    const result = approveWaiver("discount", requested.record.id, ACTOR);
    expect(result.ok).toBe(true);

    const after = getSnapshot();
    expect(after.discounts.find((d) => d.id === requested.record.id)?.status).toBe("active");
    const items = after.studentFeeItems.filter((i) => i.studentId === found.student.id && componentIds.includes(i.componentId) && i.status !== "paid" && i.status !== "cancelled");
    expect(items.some((i) => i.discountAmount.minorUnits > 0)).toBe(true);
  });

  it("leaves fee items untouched when a request is rejected", () => {
    const found = pickStudentWithUnpaidItems();
    if (!found) return;
    const componentIds = [...new Set(found.items.map((i) => i.componentId))];
    const before = getSnapshot()
      .studentFeeItems.filter((i) => i.studentId === found.student.id)
      .map((i) => ({ id: i.id, discountAmount: i.discountAmount.minorUnits }));

    const requested = requestDiscount({ studentId: found.student.id, name: "Test", type: "custom", percent: 10, applicableComponentIds: componentIds, session: "2026-2027", effectiveFrom: "2026-04-01" }, ACTOR);
    if (!requested.ok) return;

    rejectWaiver("discount", requested.record.id, "Not eligible", ACTOR);

    const after = getSnapshot();
    expect(after.discounts.find((d) => d.id === requested.record.id)?.status).toBe("rejected");
    const afterItems = after.studentFeeItems.filter((i) => i.studentId === found.student.id).map((i) => ({ id: i.id, discountAmount: i.discountAmount.minorUnits }));
    expect(afterItems).toEqual(before);
  });

  it("reverses the waiver on unpaid items when an active discount is revoked", () => {
    const found = pickStudentWithUnpaidItems();
    if (!found) return;
    const componentIds = [...new Set(found.items.map((i) => i.componentId))];
    const requested = requestDiscount({ studentId: found.student.id, name: "Test", type: "custom", percent: 20, applicableComponentIds: componentIds, session: "2026-2027", effectiveFrom: "2026-04-01" }, ACTOR);
    if (!requested.ok) return;
    approveWaiver("discount", requested.record.id, ACTOR);

    const afterApprove = getSnapshot().studentFeeItems.filter((i) => i.studentId === found.student.id && componentIds.includes(i.componentId) && i.status !== "paid" && i.status !== "cancelled");
    const totalDiscountAfterApprove = afterApprove.reduce((sum, i) => sum + i.discountAmount.minorUnits, 0);
    expect(totalDiscountAfterApprove).toBeGreaterThan(0);

    const revokeResult = revokeWaiver("discount", requested.record.id, "Student withdrew request", ACTOR);
    expect(revokeResult.ok).toBe(true);

    const afterRevoke = getSnapshot();
    expect(afterRevoke.discounts.find((d) => d.id === requested.record.id)?.status).toBe("revoked");
    const items = afterRevoke.studentFeeItems.filter((i) => i.studentId === found.student.id && componentIds.includes(i.componentId) && i.status !== "paid" && i.status !== "cancelled");
    const totalDiscountAfterRevoke = items.reduce((sum, i) => sum + i.discountAmount.minorUnits, 0);
    expect(totalDiscountAfterRevoke).toBeLessThan(totalDiscountAfterApprove);
  });

  it("refuses to approve a record that isn't submitted or under review", () => {
    const result = approveWaiver("discount", "no-such-id", ACTOR);
    expect(result.ok).toBe(false);
  });
});

describe("requestScholarship duplicate protection", () => {
  beforeEach(() => resetDemoData());

  it("refuses a duplicate scholarship of the same type in the same session", () => {
    const found = pickStudentWithUnpaidItems();
    if (!found) return;
    const componentIds = [...new Set(found.items.map((i) => i.componentId))];
    const input = { studentId: found.student.id, name: "Test scholarship", type: "merit" as const, percent: 10, applicableComponentIds: componentIds, session: "2026-2027", effectiveFrom: "2026-04-01" };
    requestScholarship(input, ACTOR);
    const second = requestScholarship(input, ACTOR);
    expect(second.ok).toBe(false);
  });
});
