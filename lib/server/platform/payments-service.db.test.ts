// Payments DB-integration tests (Super Admin SA-4E). Exercises the real
// payments-service against Postgres: record (partial + full → invoice PAID),
// overpayment/invalid-state guards, reversal (PAID → OPEN), double-reverse block,
// Decimal correctness, concurrency safety (FOR UPDATE lock), collected total,
// list/detail, audit events and RBAC. Namespaced ("T4E-"), removed in afterAll.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { generateInvoice, issueInvoice } from "@/lib/server/platform/invoices-service";
import {
  collectedTotal,
  getPayment,
  listPayments,
  recordPayment,
  reversePayment,
  type PaymentActor,
} from "@/lib/server/platform/payments-service";
import { platformPermissionsForRole, ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T4E-";
const stamp = Date.now().toString(36);
const actor: PaymentActor = { id: "t4e-actor", name: "T4E Tester" };
let tenantId = "";
let planId = "";
let sc = 0;
const DAY = 86_400_000;

async function makeOpenInvoice(price: number) {
  sc++;
  const school = await prisma.school.create({ data: { tenantId, name: `${NS}School ${sc}`, code: `${NS}${stamp}-${sc}`, status: "ACTIVE" }, select: { id: true } });
  const now = new Date();
  const sub = await prisma.subscription.create({
    data: {
      tenantId,
      schoolId: school.id,
      planId,
      status: "ACTIVE",
      startDate: now,
      currentPeriodStart: new Date(now.getTime() - sc * DAY), // distinct period per invoice
      currentPeriodEnd: new Date(now.getTime() + 30 * DAY),
      priceAmount: price,
      currency: "INR",
      billingInterval: "MONTHLY",
    },
    select: { id: true },
  });
  const draft = await generateInvoice(actor, { subscriptionId: sub.id });
  const open = await issueInvoice(actor, draft.id);
  return open; // InvoiceDto (status open, amountDue = price)
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS}Tenant`, slug: `t4e-${stamp}` }, select: { id: true } })).id;
  planId = (await prisma.plan.create({ data: { code: `${NS}P-${stamp}`, name: `${NS}Plan`, status: "ACTIVE", currency: "INR", price: 1000, billingInterval: "MONTHLY" }, select: { id: true } })).id;
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.payment.deleteMany({ where: { tenantId } });
  await prisma.invoice.deleteMany({ where: { tenantId } });
  await prisma.subscription.deleteMany({ where: { tenantId } });
  await prisma.plan.deleteMany({ where: { code: { startsWith: NS } } });
  await prisma.tenant.delete({ where: { id: tenantId } });
});

describe.skipIf(!dbReady)("payments service (DB)", () => {
  it("records a partial payment (invoice stays OPEN) then full settlement (→ PAID)", async () => {
    const inv = await makeOpenInvoice(10000);
    const p1 = await recordPayment(actor, { invoiceId: inv.id, amount: 4000, method: "bank-transfer", reference: "UTR-1" });
    expect(p1.status).toBe("succeeded");
    expect(p1.paymentNumber).toMatch(/^PAY-\d{4}-\d{6}$/);
    expect(p1.invoice.status).toBe("open");
    expect(p1.invoice.amountDue).toBe(6000);

    const inv1 = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id }, select: { status: true, amountPaid: true, amountDue: true } });
    expect(inv1.status).toBe("OPEN");
    expect(Number(inv1.amountPaid)).toBe(4000);
    expect(Number(inv1.amountDue)).toBe(6000);

    const p2 = await recordPayment(actor, { invoiceId: inv.id, amount: 6000, method: "upi" });
    expect(p2.invoice.status).toBe("paid");
    expect(p2.invoice.amountDue).toBe(0);
    const inv2 = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id }, select: { status: true, amountPaid: true, amountDue: true, paidAt: true } });
    expect(inv2.status).toBe("PAID");
    expect(Number(inv2.amountPaid)).toBe(10000);
    expect(Number(inv2.amountDue)).toBe(0);
    expect(inv2.paidAt).not.toBeNull();

    // Two audit events recorded.
    const audits = await prisma.auditEvent.count({ where: { entityId: { in: [p1.id, p2.id] }, action: "PAYMENT_RECORDED" } });
    expect(audits).toBe(2);
  });

  it("blocks overpayment and rejects zero/negative amounts", async () => {
    const inv = await makeOpenInvoice(1000);
    await expect(recordPayment(actor, { invoiceId: inv.id, amount: 1500, method: "cash" })).rejects.toMatchObject({ code: "PAYMENT_EXCEEDS_AMOUNT_DUE" });
    await expect(recordPayment(actor, { invoiceId: inv.id, amount: 0, method: "cash" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(recordPayment(actor, { invoiceId: inv.id, amount: -50, method: "cash" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects paying a DRAFT / VOID / already-PAID / unknown invoice", async () => {
    // DRAFT (not issued)
    const school = await prisma.school.create({ data: { tenantId, name: `${NS}Draft`, code: `${NS}${stamp}-draft`, status: "ACTIVE" }, select: { id: true } });
    const now = new Date();
    const sub = await prisma.subscription.create({ data: { tenantId, schoolId: school.id, planId, status: "ACTIVE", startDate: now, currentPeriodStart: new Date(now.getTime() - 999 * DAY), currentPeriodEnd: now, priceAmount: 1000, currency: "INR", billingInterval: "MONTHLY" }, select: { id: true } });
    const draft = await generateInvoice(actor, { subscriptionId: sub.id });
    await expect(recordPayment(actor, { invoiceId: draft.id, amount: 100, method: "cash" })).rejects.toMatchObject({ code: "INVOICE_NOT_OPEN" });

    // PAID
    const paidInv = await makeOpenInvoice(500);
    await recordPayment(actor, { invoiceId: paidInv.id, amount: 500, method: "cash" });
    await expect(recordPayment(actor, { invoiceId: paidInv.id, amount: 100, method: "cash" })).rejects.toMatchObject({ code: "INVOICE_NOT_OPEN" });

    // Unknown
    await expect(recordPayment(actor, { invoiceId: "nope", amount: 100, method: "cash" })).rejects.toMatchObject({ code: "INVOICE_NOT_FOUND" });
  });

  it("reverses a payment: payment REVERSED, invoice PAID → OPEN, and blocks double reversal", async () => {
    const inv = await makeOpenInvoice(3000);
    const pay = await recordPayment(actor, { invoiceId: inv.id, amount: 3000, method: "cheque" });
    expect(pay.invoice.status).toBe("paid");

    const reversed = await reversePayment(actor, pay.id);
    expect(reversed.status).toBe("reversed");
    expect(reversed.reversedAt).not.toBeNull();

    const inv2 = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id }, select: { status: true, amountPaid: true, amountDue: true, paidAt: true } });
    expect(inv2.status).toBe("OPEN"); // re-opened
    expect(Number(inv2.amountPaid)).toBe(0);
    expect(Number(inv2.amountDue)).toBe(3000);
    expect(inv2.paidAt).toBeNull();

    await expect(reversePayment(actor, pay.id)).rejects.toMatchObject({ code: "PAYMENT_ALREADY_REVERSED" });
    await expect(reversePayment(actor, "nope")).rejects.toMatchObject({ code: "PAYMENT_NOT_FOUND" });

    const audit = await prisma.auditEvent.findFirst({ where: { entityId: pay.id, action: "PAYMENT_REVERSED" } });
    expect(audit).not.toBeNull();
  });

  it("handles Decimal amounts precisely (999.99 + 0.01 = 1000.00)", async () => {
    const inv = await makeOpenInvoice(1000);
    const p1 = await recordPayment(actor, { invoiceId: inv.id, amount: 999.99, method: "bank-transfer" });
    expect(p1.amount).toBe(999.99);
    expect(p1.invoice.amountDue).toBe(0.01);
    expect(p1.invoice.status).toBe("open");
    const p2 = await recordPayment(actor, { invoiceId: inv.id, amount: 0.01, method: "cash" });
    expect(p2.invoice.amountDue).toBe(0);
    expect(p2.invoice.status).toBe("paid");
  });

  it("is concurrency-safe: two full payments on one invoice — exactly one succeeds", async () => {
    const inv = await makeOpenInvoice(2000);
    const results = await Promise.allSettled([
      recordPayment(actor, { invoiceId: inv.id, amount: 2000, method: "cash" }),
      recordPayment(actor, { invoiceId: inv.id, amount: 2000, method: "upi" }),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    // The invoice is settled exactly once (not over-settled).
    const row = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id }, select: { status: true, amountPaid: true, amountDue: true } });
    expect(row.status).toBe("PAID");
    expect(Number(row.amountPaid)).toBe(2000);
    expect(Number(row.amountDue)).toBe(0);
    const paymentCount = await prisma.payment.count({ where: { invoiceId: inv.id, status: "SUCCEEDED" } });
    expect(paymentCount).toBe(1);
  });

  it("lists with search/method/status filters + pagination, and reads detail", async () => {
    const inv = await makeOpenInvoice(1200);
    const pay = await recordPayment(actor, { invoiceId: inv.id, amount: 1200, method: "bank-transfer", reference: `${NS}REF-XYZ` });

    const search = await listPayments({ page: 1, pageSize: 100, search: `${NS}REF-XYZ` });
    expect(search.data.some((p) => p.id === pay.id)).toBe(true);

    const byMethod = await listPayments({ page: 1, pageSize: 100, search: NS, method: "bank-transfer" });
    expect(byMethod.data.every((p) => p.method === "bank-transfer")).toBe(true);

    const paged = await listPayments({ page: 1, pageSize: 1, search: NS });
    expect(paged.data.length).toBe(1);
    expect(paged.meta.pageSize).toBe(1);

    const detail = await getPayment(pay.id);
    expect(Object.keys(detail.school).sort()).toEqual(["code", "id", "name"]);
    expect(detail.invoice.invoiceNumber).toBe(inv.invoiceNumber);
    await expect(getPayment("missing")).rejects.toMatchObject({ code: "PAYMENT_NOT_FOUND" });
  });

  it("collectedTotal is a valid aggregate; reversed payments drop out of SUCCEEDED", async () => {
    // collectedTotal() sums global SUCCEEDED payments, so it races with parallel
    // test files — assert it is a finite non-negative number (exercised), and
    // prove the reversed-exclusion via a targeted status query on our own payment.
    const inv = await makeOpenInvoice(800);
    const pay = await recordPayment(actor, { invoiceId: inv.id, amount: 800, method: "cash" });
    const total = await collectedTotal();
    expect(Number.isFinite(total)).toBe(true);
    expect(total).toBeGreaterThanOrEqual(800);

    // Before reversal our payment is SUCCEEDED.
    const succ = await listPayments({ page: 1, pageSize: 10, search: pay.paymentNumber, status: "succeeded" });
    expect(succ.data.some((p) => p.id === pay.id)).toBe(true);

    await reversePayment(actor, pay.id);
    // After reversal it is REVERSED (and thus excluded from collectedTotal's SUCCEEDED filter).
    const stillSucc = await listPayments({ page: 1, pageSize: 10, search: pay.paymentNumber, status: "succeeded" });
    expect(stillSucc.data.some((p) => p.id === pay.id)).toBe(false);
    const reversed = await listPayments({ page: 1, pageSize: 10, search: pay.paymentNumber, status: "reversed" });
    expect(reversed.data.some((p) => p.id === pay.id)).toBe(true);
  });

  it("RBAC: platform.payments.* is platform-scoped and denied to school roles", async () => {
    for (const role of ["SUPER_ADMIN", "BILLING"]) {
      expect(platformPermissionsForRole(role)).toEqual(expect.arrayContaining(["platform.payments.view", "platform.payments.manage"]));
    }
    // SUPPORT + AUDITOR: view-only.
    expect(platformPermissionsForRole("SUPPORT")).toContain("platform.payments.view");
    expect(platformPermissionsForRole("SUPPORT")).not.toContain("platform.payments.manage");
    expect(platformPermissionsForRole("AUDITOR")).toContain("platform.payments.view");
    expect(platformPermissionsForRole("AUDITOR")).not.toContain("platform.payments.manage");
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      expect(perms).not.toContain("platform.payments.view");
      expect(perms).not.toContain("platform.payments.manage");
    }
  });
});
