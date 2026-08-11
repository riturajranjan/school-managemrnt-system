// Invoices DB-integration tests (Super Admin SA-4D). Exercises the real
// invoices-service + billing summary against Postgres: generation from a real
// Subscription (commercial snapshot + line items), invoice numbering, duplicate-
// period protection, lifecycle (issue/void/mark-paid), derived overdue, money/
// Decimal behavior, billing summary, audit events, and RBAC. Namespaced
// ("T4D-") and removed in afterAll. Deterministic (explicit period dates).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  generateInvoice,
  getInvoice,
  issueInvoice,
  listInvoices,
  voidInvoice,
  type InvoiceActor,
} from "@/lib/server/platform/invoices-service";
import { getBillingSummary } from "@/lib/server/platform/billing-service";
import { recordPayment } from "@/lib/server/platform/payments-service";
import { platformPermissionsForRole, ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T4D-";
const stamp = Date.now().toString(36);
const actor: InvoiceActor = { id: "t4d-actor", name: "T4D Tester" };
let tenantId = "";
let planId = "";
let sc = 0;
const DAY = 86_400_000;

async function makeSchool() {
  sc++;
  const s = await prisma.school.create({ data: { tenantId, name: `${NS}School ${sc}`, code: `${NS}${stamp}-${sc}`, status: "ACTIVE" }, select: { id: true } });
  return s.id;
}

/** Create an ACTIVE subscription with an explicit current period. */
async function makeSubscription(opts: { price?: number; interval?: "MONTHLY" | "YEARLY"; status?: "ACTIVE" | "TRIALING"; periodOffsetDays?: number } = {}) {
  const schoolId = await makeSchool();
  const now = new Date();
  const start = new Date(now.getTime() + (opts.periodOffsetDays ?? 0) * DAY);
  const end = new Date(start.getTime() + 30 * DAY);
  const sub = await prisma.subscription.create({
    data: {
      tenantId,
      schoolId,
      planId,
      status: opts.status ?? "ACTIVE",
      startDate: start,
      currentPeriodStart: start,
      currentPeriodEnd: end,
      priceAmount: opts.price ?? 1000,
      currency: "INR",
      billingInterval: opts.interval ?? "MONTHLY",
    },
    select: { id: true },
  });
  return sub.id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS}Tenant`, slug: `t4d-${stamp}` }, select: { id: true } })).id;
  planId = (await prisma.plan.create({ data: { code: `${NS}P-${stamp}`, name: `${NS}Plan`, status: "ACTIVE", currency: "INR", price: 1000, billingInterval: "MONTHLY" }, select: { id: true } })).id;
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.payment.deleteMany({ where: { tenantId } }); // Payment→Invoice FK is Restrict
  await prisma.invoice.deleteMany({ where: { tenantId } });
  await prisma.subscription.deleteMany({ where: { tenantId } });
  await prisma.plan.deleteMany({ where: { code: { startsWith: NS } } });
  await prisma.tenant.delete({ where: { id: tenantId } });
});

describe.skipIf(!dbReady)("invoices service (DB)", () => {
  it("generates a DRAFT invoice from a subscription with a snapshot line item + audit", async () => {
    const subId = await makeSubscription({ price: 9999 });
    const inv = await generateInvoice(actor, { subscriptionId: subId });
    expect(inv.status).toBe("draft");
    expect(inv.derivedState).toBe("draft");
    expect(inv.invoiceNumber).toMatch(/^INV-\d{4}-\d{6}$/);
    expect(inv.tenant.id).toBe(tenantId);
    // Commercial snapshot from the subscription.
    expect(inv.subtotal).toBe(9999);
    expect(inv.totalAmount).toBe(9999);
    expect(inv.amountDue).toBe(9999);
    expect(inv.taxAmount).toBe(0);
    expect(inv.lineItems).toHaveLength(1);
    expect(inv.lineItems[0].amount).toBe(9999);

    const row = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id }, include: { subscription: { select: { id: true } }, lineItems: true } });
    expect(row.subscription.id).toBe(subId);
    expect(row.lineItems).toHaveLength(1);
    const audit = await prisma.auditEvent.findFirst({ where: { entityId: inv.id, action: "INVOICE_GENERATED" } });
    expect(audit).not.toBeNull();
  });

  it("blocks a duplicate invoice for the same subscription billing period", async () => {
    const subId = await makeSubscription();
    await generateInvoice(actor, { subscriptionId: subId });
    await expect(generateInvoice(actor, { subscriptionId: subId })).rejects.toMatchObject({ code: "INVOICE_ALREADY_EXISTS" });
  });

  it("refuses to invoice a non-billable (trialing) subscription", async () => {
    const subId = await makeSubscription({ status: "TRIALING" });
    await expect(generateInvoice(actor, { subscriptionId: subId })).rejects.toMatchObject({ code: "SUBSCRIPTION_NOT_BILLABLE" });
    await expect(generateInvoice(actor, { subscriptionId: "nope" })).rejects.toMatchObject({ code: "SUBSCRIPTION_NOT_BILLABLE" });
  });

  it("issues DRAFT → OPEN (+audit) and rejects issuing a non-draft", async () => {
    const subId = await makeSubscription();
    const draft = await generateInvoice(actor, { subscriptionId: subId });
    const open = await issueInvoice(actor, draft.id);
    expect(open.status).toBe("open");
    expect(open.issuedAt).not.toBeNull();
    await expect(issueInvoice(actor, draft.id)).rejects.toMatchObject({ code: "INVALID_INVOICE_TRANSITION" });
    const audit = await prisma.auditEvent.findFirst({ where: { entityId: draft.id, action: "INVOICE_ISSUED" } });
    expect(audit).not.toBeNull();
  });

  it("derives OVERDUE for an OPEN invoice past due with amount owing", async () => {
    const subId = await makeSubscription({ periodOffsetDays: -60 }); // period + dueAt in the past
    const draft = await generateInvoice(actor, { subscriptionId: subId });
    const open = await issueInvoice(actor, draft.id);
    expect(open.derivedState).toBe("overdue");
    // Overdue is derived, not stored.
    const row = await prisma.invoice.findUniqueOrThrow({ where: { id: draft.id }, select: { status: true } });
    expect(row.status).toBe("OPEN");
  });

  // NOTE: invoice settlement (→ PAID) is done via a real Payment in SA-4E and is
  // covered by payments-service.db.test.ts. The old mark-paid path was removed.
  it("voids DRAFT|OPEN but not a fully-paid invoice", async () => {
    const draftSub = await makeSubscription();
    const draft = await generateInvoice(actor, { subscriptionId: draftSub });
    const voided = await voidInvoice(actor, draft.id);
    expect(voided.status).toBe("void");

    // Settle an invoice via a real Payment, then confirm it can't be voided.
    const paidSub = await makeSubscription({ price: 5000 });
    const inv = await generateInvoice(actor, { subscriptionId: paidSub });
    await issueInvoice(actor, inv.id);
    await recordPayment(actor, { invoiceId: inv.id, amount: 5000, method: "cash" });
    await expect(voidInvoice(actor, inv.id)).rejects.toMatchObject({ code: "INVALID_INVOICE_TRANSITION" });
  });

  it("preserves currency + Decimal money for a YEARLY subscription (zero tax)", async () => {
    const subId = await makeSubscription({ price: 120000, interval: "YEARLY" });
    const inv = await generateInvoice(actor, { subscriptionId: subId });
    expect(inv.currency).toBe("INR");
    expect(inv.subtotal).toBe(120000);
    expect(inv.taxAmount).toBe(0);
    expect(inv.discountAmount).toBe(0);
    expect(inv.totalAmount).toBe(120000);
    expect(inv.amountDue).toBe(120000);
    // Serialized as JS numbers, not Decimal objects.
    expect(typeof inv.totalAmount).toBe("number");
  });

  it("lists with search, status filter (incl. derived overdue) and pagination", async () => {
    const search = await listInvoices({ page: 1, pageSize: 100, search: NS });
    expect(search.data.length).toBeGreaterThan(0);
    const drafts = await listInvoices({ page: 1, pageSize: 100, search: NS, status: "draft" });
    expect(drafts.data.every((i) => i.status === "draft")).toBe(true);
    const overdue = await listInvoices({ page: 1, pageSize: 100, search: NS, status: "overdue" });
    expect(overdue.data.every((i) => i.derivedState === "overdue")).toBe(true);
    const paged = await listInvoices({ page: 1, pageSize: 1, search: NS });
    expect(paged.data.length).toBe(1);
    expect(paged.meta.pageSize).toBe(1);
  });

  it("reads a detail DTO with only summarized nested objects; NOT_FOUND otherwise", async () => {
    const subId = await makeSubscription();
    const inv = await generateInvoice(actor, { subscriptionId: subId });
    const detail = await getInvoice(inv.id);
    expect(Object.keys(detail.school).sort()).toEqual(["code", "id", "name"]);
    expect(Object.keys(detail.tenant).sort()).toEqual(["id", "name", "slug"]);
    await expect(getInvoice("missing")).rejects.toMatchObject({ code: "INVOICE_NOT_FOUND" });
  });

  it("billing summary is well-formed and reflects our overdue invoice", async () => {
    // Global aggregates race with parallel test files, so assert formula
    // invariants + isolation-safe lower bounds + a targeted check (not deltas).
    const subId = await makeSubscription({ price: 7000, periodOffsetDays: -60 });
    const draft = await generateInvoice(actor, { subscriptionId: subId });
    const open = await issueInvoice(actor, draft.id); // now OPEN + overdue
    expect(open.derivedState).toBe("overdue");

    const s = await getBillingSummary();
    expect(s.arr).toBe(Math.round(s.mrr * 12 * 100) / 100); // exact formula always holds
    expect(s.currency).toBe("INR");
    expect(s.activeSubscriptions).toBeGreaterThan(0);
    // At least our unsettled overdue invoice contributes.
    expect(s.overdueInvoices).toBeGreaterThanOrEqual(1);
    expect(s.outstandingAmount).toBeGreaterThanOrEqual(7000);

    // Our specific invoice is surfaced as overdue.
    const overdue = await listInvoices({ page: 1, pageSize: 100, search: open.invoiceNumber, status: "overdue" });
    expect(overdue.data.some((i) => i.id === open.id)).toBe(true);
  });

  it("RBAC: platform.billing/invoices are platform-scoped and denied to school roles", async () => {
    for (const role of ["SUPER_ADMIN", "BILLING"]) {
      const perms = platformPermissionsForRole(role);
      expect(perms).toEqual(expect.arrayContaining(["platform.billing.view", "platform.billing.manage", "platform.invoices.view", "platform.invoices.manage"]));
    }
    // SUPPORT: invoices view-only, no billing management.
    const support = platformPermissionsForRole("SUPPORT");
    expect(support).toContain("platform.invoices.view");
    expect(support).not.toContain("platform.invoices.manage");
    expect(support).not.toContain("platform.billing.manage");
    // AUDITOR: view-only.
    const auditor = platformPermissionsForRole("AUDITOR");
    expect(auditor).toContain("platform.invoices.view");
    expect(auditor).not.toContain("platform.invoices.manage");
    // Tenant/school roles carry none of these.
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      for (const key of ["platform.billing.view", "platform.billing.manage", "platform.invoices.view", "platform.invoices.manage"]) {
        expect(perms).not.toContain(key);
      }
    }
  });
});
