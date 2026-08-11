import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import {
  setEntitlementOverride, setTenantStatus,
} from "./saas-service";

// NOTE: mock `createTenant` was removed in Super Admin Phase SA-3 (school creation
// is now real via POST /api/super-admin/schools). Its tests were removed with it.
describe("tenant lifecycle", () => {
  beforeEach(() => resetDemoData());

  it("suspend then reactivate updates status", () => {
    const t = getSnapshot().saas.tenants.find((x) => x.status === "active")!;
    setTenantStatus(t.id, "suspended");
    expect(getSnapshot().saas.tenants.find((x) => x.id === t.id)!.status).toBe("suspended");
    setTenantStatus(t.id, "active");
    expect(getSnapshot().saas.tenants.find((x) => x.id === t.id)!.status).toBe("active");
  });
});

// NOTE: subscription + trial mock CRUD were removed as those modules went real —
// `changePlan`/`setSubscriptionStatus` in SA-4B, `extendTrial` in SA-4C. They are
// now exercised by the DB-integration tests for subscriptions-service /
// trials-service, not this mock-store suite.

// NOTE: mock `setInvoiceStatus` was removed in Super Admin Phase SA-4D — billing
// + invoices are now real (/api/super-admin/invoices), covered by
// invoices-service DB integration tests.

describe("entitlement overrides", () => {
  beforeEach(() => resetDemoData());

  it("sets and updates a tenant feature override", () => {
    const t = getSnapshot().saas.tenants[0];
    setEntitlementOverride(t.id, "analytics", "included", "Pilot access");
    let ov = getSnapshot().saas.overrides.find((o) => o.tenantId === t.id && o.featureKey === "analytics")!;
    expect(ov.level).toBe("included");
    setEntitlementOverride(t.id, "analytics", "not-available", "Pilot ended");
    ov = getSnapshot().saas.overrides.find((o) => o.tenantId === t.id && o.featureKey === "analytics")!;
    expect(ov.level).toBe("not-available");
    expect(getSnapshot().saas.overrides.filter((o) => o.tenantId === t.id && o.featureKey === "analytics")).toHaveLength(1);
  });
});

// NOTE: the `saas-brief` selectors were removed as the dashboard went real —
// `platformPulse` (SA-4F), mock `tenantHealth` (SA-4I) and `saasSummary` +
// dead analytics selectors (SA-4J). Dashboard metrics are real now (dashboard/
// health/billing/usage/support services + DB integration tests).
