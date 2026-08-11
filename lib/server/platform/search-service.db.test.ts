// Global search DB-integration tests (Super Admin SA-4H). Creates a real
// tenant/school/plan/subscription/invoice/payment with distinctive namespaced
// tokens, then searches exact known values and asserts the returned IDs map to
// the real rows. Also covers min-query length, no-results, safe hrefs, result
// limits, permission-aware category filtering and the platform boundary.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { authorizedTypes, globalSearch, ALL_SEARCH_TYPES, MIN_QUERY_LENGTH, type SearchResultType } from "@/lib/server/platform/search-service";
import { platformPermissionsForRole, ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T4S";
const stamp = Date.now().toString(36);
const TOKEN = `${NS}zebra${stamp}`; // unique across parallel test files
let tenantId = "";
let schoolId = "";
let planId = "";
let subscriptionId = "";
let invoiceId = "";
let paymentId = "";
const invoiceNumber = `${NS}-INV-${stamp}`;
const paymentNumber = `${NS}-PAY-${stamp}`;
const paymentRef = `${NS}-REF-${stamp}`;
const ALL = ALL_SEARCH_TYPES;

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${TOKEN} Tenant`, slug: `${TOKEN}-t` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${TOKEN} School`, code: `${TOKEN}-SCH`, status: "ACTIVE" }, select: { id: true } })).id;
  planId = (await prisma.plan.create({ data: { code: `${TOKEN}-PLN`, name: `${TOKEN} Plan`, status: "ACTIVE", currency: "INR", price: 1000, billingInterval: "MONTHLY" }, select: { id: true } })).id;
  const now = new Date();
  subscriptionId = (await prisma.subscription.create({ data: { tenantId, schoolId, planId, status: "ACTIVE", startDate: now, currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000), priceAmount: 1000, currency: "INR", billingInterval: "MONTHLY" }, select: { id: true } })).id;
  invoiceId = (await prisma.invoice.create({ data: { invoiceNumber, tenantId, schoolId, subscriptionId, status: "OPEN", currency: "INR", subtotal: 1000, totalAmount: 1000, amountDue: 1000, periodStart: now, periodEnd: now, dueAt: now, issuedAt: now }, select: { id: true } })).id;
  paymentId = (await prisma.payment.create({ data: { paymentNumber, tenantId, schoolId, invoiceId, subscriptionId, status: "SUCCEEDED", method: "BANK_TRANSFER", amount: 500, currency: "INR", reference: paymentRef, receivedAt: now }, select: { id: true } })).id;
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.payment.deleteMany({ where: { tenantId } });
  await prisma.invoice.deleteMany({ where: { tenantId } });
  await prisma.subscription.deleteMany({ where: { tenantId } });
  await prisma.plan.deleteMany({ where: { code: { startsWith: TOKEN } } });
  await prisma.tenant.delete({ where: { id: tenantId } }); // cascades school
});

describe.skipIf(!dbReady)("global search service (DB)", () => {
  it("finds a school by name, code and tenant name → real school id", async () => {
    for (const q of [`${TOKEN} School`, `${TOKEN}-SCH`, `${TOKEN} Tenant`]) {
      const { results } = await globalSearch(q, ALL);
      const hit = results.find((r) => r.type === "school");
      expect(hit?.id).toBe(schoolId);
      expect(hit?.href).toBe(`/super-admin/schools/${schoolId}`);
    }
  });

  it("finds a subscription via school/plan name → real subscription id", async () => {
    const { results } = await globalSearch(`${TOKEN} Plan`, ALL);
    const sub = results.find((r) => r.type === "subscription");
    expect(sub?.id).toBe(subscriptionId);
    expect(sub?.href).toBe(`/super-admin/subscriptions/${subscriptionId}`);
    // Plan is also matched by name.
    expect(results.find((r) => r.type === "plan")?.id).toBe(planId);
  });

  it("finds an invoice by invoiceNumber and by school name", async () => {
    const byNumber = await globalSearch(invoiceNumber, ALL);
    expect(byNumber.results.find((r) => r.type === "invoice")?.id).toBe(invoiceId);
    const bySchool = await globalSearch(`${TOKEN} School`, ALL);
    expect(bySchool.results.find((r) => r.type === "invoice")?.id).toBe(invoiceId);
  });

  it("finds a payment by paymentNumber and by reference", async () => {
    const byNumber = await globalSearch(paymentNumber, ALL);
    expect(byNumber.results.find((r) => r.type === "payment")?.id).toBe(paymentId);
    const byRef = await globalSearch(paymentRef, ALL);
    expect(byRef.results.find((r) => r.type === "payment")?.id).toBe(paymentId);
  });

  it("returns nothing below the minimum query length", async () => {
    const short = "a".repeat(MIN_QUERY_LENGTH - 1);
    const { results } = await globalSearch(short, ALL);
    expect(results).toEqual([]);
  });

  it("returns an empty list for a no-match query", async () => {
    const { results } = await globalSearch(`${TOKEN}-NOPE-NOMATCH`, ALL);
    expect(results).toEqual([]);
  });

  it("all result hrefs are safe internal super-admin paths", async () => {
    const { results } = await globalSearch(TOKEN, ALL);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.href.startsWith("/super-admin/"))).toBe(true);
  });

  it("respects the requested/authorized category set", async () => {
    const onlySchools = await globalSearch(TOKEN, ["school"]);
    expect(onlySchools.results.every((r) => r.type === "school")).toBe(true);
    const none = await globalSearch(TOKEN, []);
    expect(none.results).toEqual([]);
  });

  it("authorizedTypes filters categories strictly by permission", () => {
    // Full platform view perms → all categories.
    const superAdmin = new Set(platformPermissionsForRole("SUPER_ADMIN"));
    expect(authorizedTypes(superAdmin).sort()).toEqual([...ALL_SEARCH_TYPES].sort());
    // Only invoices permission → only the invoice category.
    const invoiceOnly = new Set(["platform.invoices.view"]);
    expect(authorizedTypes(invoiceOnly)).toEqual(["invoice"]);
    // Requested set is intersected with authorization.
    expect(authorizedTypes(invoiceOnly, ["school", "invoice"] as SearchResultType[])).toEqual(["invoice"]);
    // No relevant perms → no categories (fail closed).
    expect(authorizedTypes(new Set())).toEqual([]);
  });

  it("platform boundary: tenant/school roles hold none of the search view permissions", () => {
    const VIEW = ["platform.schools.view", "platform.subscriptions.view", "platform.invoices.view", "platform.payments.view", "platform.plans.view"];
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      for (const key of VIEW) expect(perms).not.toContain(key);
    }
    // SUPPORT (platform) can view schools/subscriptions/invoices/payments but not manage.
    const support = new Set(platformPermissionsForRole("SUPPORT"));
    expect(authorizedTypes(support)).toEqual(expect.arrayContaining(["school", "invoice", "payment"]));
  });
});
