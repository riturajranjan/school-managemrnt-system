import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import {
  setEntitlementOverride, setInvoiceStatus, setTenantStatus,
} from "./saas-service";
import { platformPulse, saasSummary, tenantHealth } from "@/lib/selectors/saas-brief";

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

describe("billing", () => {
  beforeEach(() => resetDemoData());

  it("marking an invoice paid creates a successful payment", () => {
    const inv = getSnapshot().saas.invoices.find((i) => i.status !== "paid")!;
    const beforePayments = getSnapshot().saas.payments.length;
    setInvoiceStatus(inv.id, "paid");
    const db = getSnapshot();
    expect(db.saas.invoices.find((i) => i.id === inv.id)!.status).toBe("paid");
    expect(db.saas.payments.length).toBe(beforePayments + 1);
  });
});

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

  it("summary reports total schools and non-negative MRR", () => {
    const s = saasSummary(getSnapshot());
    expect(s.totalSchools).toBeGreaterThan(0);
    expect(s.mrrMinor).toBeGreaterThanOrEqual(0);
  });

  it("platform pulse is within 0-100", () => {
    const p = platformPulse(getSnapshot());
    expect(p.score).toBeGreaterThanOrEqual(0);
    expect(p.score).toBeLessThanOrEqual(100);
    expect(p.factors.length).toBe(6);
  });

  it("suspended tenant reports suspended health", () => {
    const db = getSnapshot();
    const t = db.saas.tenants.find((x) => x.status === "suspended");
    if (t) expect(tenantHealth(db.saas, t).state).toBe("suspended");
  });

  it("healthy tenant lists a normal-range reason", () => {
    const db = getSnapshot();
    const active = db.saas.tenants.find((x) => x.status === "active" && x.setupPercent >= 90);
    if (active) {
      const h = tenantHealth(db.saas, active);
      expect(["healthy", "needs-attention", "at-risk"]).toContain(h.state);
      expect(h.reasons.length).toBeGreaterThan(0);
    }
  });
});
