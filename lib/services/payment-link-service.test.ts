import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { moneyFromMajor } from "@/lib/finance/money";
import { cancelPaymentLink, createPaymentLink, isPaymentLinkExpired, simulateGatewayCallback } from "./payment-link-service";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };

function pickStudentWithUnpaidItems() {
  const db = getSnapshot();
  const student = db.students.find((s) => db.studentFeeItems.some((i) => i.studentId === s.id && (i.status === "pending" || i.status === "overdue")));
  if (!student) return null;
  const items = db.studentFeeItems.filter((i) => i.studentId === student.id && (i.status === "pending" || i.status === "overdue"));
  return { student, items };
}

describe("createPaymentLink", () => {
  beforeEach(() => resetDemoData());

  it("creates an active link with a future expiry", () => {
    const found = pickStudentWithUnpaidItems();
    if (!found) return;
    const link = createPaymentLink([found.student.id], found.items.map((i) => i.id), moneyFromMajor(1000, "INR"), 7, ACTOR);
    expect(link.status).toBe("active");
    expect(new Date(link.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(getSnapshot().paymentLinks.some((l) => l.id === link.id)).toBe(true);
  });

  it("supports multiple students on a single link", () => {
    const link = createPaymentLink(["student-a", "student-b"], [], moneyFromMajor(500, "INR"), 7, ACTOR);
    expect(link.studentIds).toEqual(["student-a", "student-b"]);
  });
});

describe("isPaymentLinkExpired", () => {
  it("is false for a freshly created link and true once its expiry has passed", () => {
    const active = createPaymentLink(["s1"], [], moneyFromMajor(100, "INR"), 7, ACTOR);
    expect(isPaymentLinkExpired(active)).toBe(false);
    const expired = { ...active, expiresAt: new Date(Date.now() - 1000).toISOString() };
    expect(isPaymentLinkExpired(expired)).toBe(true);
  });
});

describe("cancelPaymentLink", () => {
  beforeEach(() => resetDemoData());

  it("marks the link cancelled", () => {
    const link = createPaymentLink(["student-a"], [], moneyFromMajor(100, "INR"), 7, ACTOR);
    cancelPaymentLink(link.id, ACTOR);
    expect(getSnapshot().paymentLinks.find((l) => l.id === link.id)?.status).toBe("cancelled");
  });
});

describe("simulateGatewayCallback", () => {
  beforeEach(() => resetDemoData());

  it("settles the linked student's items and marks the link paid on a successful outcome", () => {
    const found = pickStudentWithUnpaidItems();
    if (!found) return;
    const link = createPaymentLink([found.student.id], found.items.map((i) => i.id), moneyFromMajor(1000, "INR"), 7, ACTOR);
    const result = simulateGatewayCallback(link.id, "razorpay", "success", ACTOR);
    expect(result.ok).toBe(true);

    const after = getSnapshot();
    expect(after.paymentLinks.find((l) => l.id === link.id)?.status).toBe("paid");
    const payment = after.payments.find((p) => p.studentId === found.student.id && p.method === "online-gateway");
    expect(payment).toBeDefined();
    expect(payment?.gatewayProvider).toBe("razorpay");
  });

  it("does not credit anything on a failed outcome, and leaves the link active for retry", () => {
    const found = pickStudentWithUnpaidItems();
    if (!found) return;
    const link = createPaymentLink([found.student.id], found.items.map((i) => i.id), moneyFromMajor(1000, "INR"), 7, ACTOR);
    const paymentsBefore = getSnapshot().payments.length;
    const result = simulateGatewayCallback(link.id, "razorpay", "failure", ACTOR);
    expect(result.ok).toBe(false);
    expect(getSnapshot().payments.length).toBe(paymentsBefore);
    expect(getSnapshot().paymentLinks.find((l) => l.id === link.id)?.status).toBe("active");
  });

  it("refuses to settle an already-paid link a second time", () => {
    const found = pickStudentWithUnpaidItems();
    if (!found) return;
    const link = createPaymentLink([found.student.id], found.items.map((i) => i.id), moneyFromMajor(1000, "INR"), 7, ACTOR);
    simulateGatewayCallback(link.id, "razorpay", "success", ACTOR);
    const paymentsAfterFirst = getSnapshot().payments.length;
    const second = simulateGatewayCallback(link.id, "razorpay", "success", ACTOR);
    expect(second.ok).toBe(false);
    expect(getSnapshot().payments.length).toBe(paymentsAfterFirst);
  });

  it("refuses to settle an expired link", () => {
    const found = pickStudentWithUnpaidItems();
    if (!found) return;
    const link = createPaymentLink([found.student.id], found.items.map((i) => i.id), moneyFromMajor(1000, "INR"), -1, ACTOR);
    expect(isPaymentLinkExpired(link)).toBe(true);
    const result = simulateGatewayCallback(link.id, "razorpay", "success", ACTOR);
    expect(result.ok).toBe(false);
    expect(getSnapshot().paymentLinks.find((l) => l.id === link.id)?.status).toBe("expired");
  });

  it("is idempotent per student — settling twice for the same link+student never double-pays", () => {
    const found = pickStudentWithUnpaidItems();
    if (!found) return;
    const link = createPaymentLink([found.student.id], found.items.map((i) => i.id), moneyFromMajor(1000, "INR"), 7, ACTOR);
    simulateGatewayCallback(link.id, "razorpay", "success", ACTOR);
    const paymentsAfterFirst = getSnapshot().payments.filter((p) => p.studentId === found.student.id && p.method === "online-gateway").length;
    expect(paymentsAfterFirst).toBe(1);
  });
});
