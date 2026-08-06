import { describe, expect, it } from "vitest";
import { moneyFromMajor, zeroMoney } from "@/lib/finance/money";
import { netDueForItem, outstandingForItem, totalOutstanding, totalOverdue } from "./fee-item-insights";
import type { StudentFeeItem } from "@/lib/types/fees";

function item(overrides: Partial<StudentFeeItem>): StudentFeeItem {
  return {
    id: "sfi-1",
    assignmentId: "sfa-1",
    studentId: "student-1",
    session: "2026-2027",
    structureId: "fs-1",
    componentId: "fc-1",
    componentType: "tuition",
    label: "Tuition — Installment 1",
    billedAmount: moneyFromMajor(10000, "INR"),
    discountAmount: zeroMoney("INR"),
    scholarshipAmount: zeroMoney("INR"),
    fineAmount: zeroMoney("INR"),
    paidAmount: zeroMoney("INR"),
    dueDate: "2026-06-15",
    status: "pending",
    refundable: false,
    ...overrides,
  };
}

describe("netDueForItem", () => {
  it("equals billedAmount when there is no discount or scholarship", () => {
    expect(netDueForItem(item({})).minorUnits).toBe(1000000);
  });

  it("subtracts both discount and scholarship from the billed amount", () => {
    const result = netDueForItem(item({ discountAmount: moneyFromMajor(1000, "INR"), scholarshipAmount: moneyFromMajor(500, "INR") }));
    expect(result.minorUnits).toBe(moneyFromMajor(8500, "INR").minorUnits);
  });
});

describe("outstandingForItem", () => {
  it("is zero once the item is fully paid", () => {
    const paid = item({ paidAmount: moneyFromMajor(10000, "INR") });
    expect(outstandingForItem(paid).minorUnits).toBe(0);
  });

  it("adds the fine on top of the net due before subtracting payments", () => {
    const overdue = item({ status: "overdue", fineAmount: moneyFromMajor(200, "INR") });
    expect(outstandingForItem(overdue).minorUnits).toBe(moneyFromMajor(10200, "INR").minorUnits);
  });

  it("never goes negative even if a payment somehow exceeded the due amount", () => {
    const overpaid = item({ paidAmount: moneyFromMajor(15000, "INR") });
    expect(outstandingForItem(overpaid).minorUnits).toBe(0);
  });
});

describe("totalOutstanding / totalOverdue", () => {
  it("sums outstanding across items and isolates overdue-only items", () => {
    const items = [
      item({ id: "a", status: "paid", paidAmount: moneyFromMajor(10000, "INR") }),
      item({ id: "b", status: "overdue", fineAmount: moneyFromMajor(200, "INR") }),
      item({ id: "c", status: "pending" }),
    ];
    expect(totalOutstanding(items).minorUnits).toBe(moneyFromMajor(20200, "INR").minorUnits);
    expect(totalOverdue(items).minorUnits).toBe(moneyFromMajor(10200, "INR").minorUnits);
  });

  it("returns zero for an empty item list", () => {
    expect(totalOutstanding([]).minorUnits).toBe(0);
    expect(totalOverdue([]).minorUnits).toBe(0);
  });
});
