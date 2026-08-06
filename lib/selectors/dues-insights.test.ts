import { describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { moneyFromMajor } from "@/lib/finance/money";
import { agingBucketFor, computeAgingBuckets, computeDuesMetrics, computeHighestOverdueClasses, computeStudentDuesRows, daysOverdue } from "./dues-insights";
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
    label: "Tuition",
    billedAmount: moneyFromMajor(1000, "INR"),
    discountAmount: moneyFromMajor(0, "INR"),
    scholarshipAmount: moneyFromMajor(0, "INR"),
    fineAmount: moneyFromMajor(0, "INR"),
    paidAmount: moneyFromMajor(0, "INR"),
    dueDate: "2026-01-01",
    status: "overdue",
    refundable: false,
    ...overrides,
  };
}

const TODAY = new Date("2026-08-05T00:00:00.000Z");

describe("daysOverdue / agingBucketFor", () => {
  it("computes the number of days between the due date and today", () => {
    const overdueItem = item({ dueDate: "2026-07-26", status: "overdue" }); // 10 days before TODAY
    expect(daysOverdue(overdueItem, TODAY)).toBe(10);
  });

  it("buckets a non-overdue item as not-overdue regardless of due date", () => {
    const pendingItem = item({ dueDate: "2026-01-01", status: "pending" });
    expect(agingBucketFor(pendingItem, TODAY)).toBe("not-overdue");
  });

  it("buckets overdue items into the correct aging window", () => {
    expect(agingBucketFor(item({ dueDate: "2026-07-26", status: "overdue" }), TODAY)).toBe("1-15"); // 10 days
    expect(agingBucketFor(item({ dueDate: "2026-07-01", status: "overdue" }), TODAY)).toBe("31-60"); // 35 days
    expect(agingBucketFor(item({ dueDate: "2026-05-01", status: "overdue" }), TODAY)).toBe("90-plus"); // 96 days
  });
});

describe("computeAgingBuckets", () => {
  it("groups overdue items by aging window and sums their outstanding amount", () => {
    const items = [item({ id: "a", dueDate: "2026-07-26", status: "overdue" }), item({ id: "b", dueDate: "2026-07-26", status: "overdue" }), item({ id: "c", dueDate: "2026-01-01", status: "pending" })];
    const buckets = computeAgingBuckets(items, "INR", TODAY);
    const shortBucket = buckets.find((b) => b.bucket === "1-15")!;
    expect(shortBucket.count).toBe(2);
    expect(shortBucket.amount.minorUnits).toBe(moneyFromMajor(2000, "INR").minorUnits);
  });

  it("excludes non-overdue items from every bucket", () => {
    const items = [item({ status: "pending" }), item({ status: "paid", paidAmount: moneyFromMajor(1000, "INR") })];
    const buckets = computeAgingBuckets(items, "INR", TODAY);
    expect(buckets.every((b) => b.count === 0)).toBe(true);
  });
});

describe("computeStudentDuesRows / computeDuesMetrics / computeHighestOverdueClasses (seed data)", () => {
  it("only includes students who actually owe something", () => {
    resetDemoData();
    const db = getSnapshot();
    const rows = computeStudentDuesRows(db);
    expect(rows.every((r) => r.outstanding.minorUnits > 0)).toBe(true);
  });

  it("sorts rows by overdue amount descending", () => {
    resetDemoData();
    const db = getSnapshot();
    const rows = computeStudentDuesRows(db);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].overdue.minorUnits).toBeGreaterThanOrEqual(rows[i].overdue.minorUnits);
    }
  });

  it("produces non-negative dues metrics consistent with the seed's known overdue population", () => {
    resetDemoData();
    const db = getSnapshot();
    const metrics = computeDuesMetrics(db);
    expect(metrics.totalOutstanding.minorUnits).toBeGreaterThanOrEqual(0);
    expect(metrics.totalOverdue.minorUnits).toBeGreaterThanOrEqual(0);
    expect(metrics.studentsOverdue).toBeGreaterThan(0);
    expect(metrics.collectionRiskAmount.minorUnits).toBeGreaterThanOrEqual(0);
    expect(metrics.averageOverdueAgeDays).toBeGreaterThanOrEqual(0);
  });

  it("ranks classes by overdue amount, highest first", () => {
    resetDemoData();
    const db = getSnapshot();
    const classes = computeHighestOverdueClasses(db);
    for (let i = 1; i < classes.length; i++) {
      expect(classes[i - 1].amount.minorUnits).toBeGreaterThanOrEqual(classes[i].amount.minorUnits);
    }
  });
});
