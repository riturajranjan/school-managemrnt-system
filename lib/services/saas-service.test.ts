import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import {
  setEntitlementOverride, setTenantStatus,
} from "./saas-service";
import { saasSummary } from "@/lib/selectors/saas-brief";

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

describe("selectors", () => {
  beforeEach(() => resetDemoData());

  it("summary reports total schools and non-negative counts", () => {
    const s = saasSummary(getSnapshot());
    expect(s.totalSchools).toBeGreaterThan(0);
    expect(s.trialSchools).toBeGreaterThanOrEqual(0);
  });

  // NOTE: mock `platformPulse` (SA-4F) and mock `tenantHealth` (SA-4I) were
  // removed — tenant health + Platform Pulse are real now (health-service DB
  // integration tests). saasSummary remains for the still-mock dashboard tiles.
});
