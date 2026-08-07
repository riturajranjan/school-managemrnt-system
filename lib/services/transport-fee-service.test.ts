import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { CURRENT_SESSION } from "@/lib/data/seed/reference";
import { moneyFromMajor } from "@/lib/finance/money";
import { generateChargesForPeriod, recordChargePayment, resolveFeeRuleForRoute, waiveCharge } from "./transport-fee-service";

const ACTOR = { name: "Accountant", role: "Accountant" };

describe("resolveFeeRuleForRoute", () => {
  beforeEach(() => resetDemoData());

  it("resolves the seeded route-based rule for an active route", () => {
    const db = getSnapshot();
    const route = db.transportRoutes[0];
    const rule = resolveFeeRuleForRoute(db, route.id, CURRENT_SESSION);
    expect(rule?.routeId).toBe(route.id);
  });
});

describe("generateChargesForPeriod", () => {
  beforeEach(() => resetDemoData());

  it("is idempotent — a second run for the same period creates nothing new", () => {
    const first = generateChargesForPeriod(CURRENT_SESSION, "2099-01", ACTOR);
    expect(first.created).toBeGreaterThan(0);
    const before = getSnapshot().transportFeeCharges.length;
    const second = generateChargesForPeriod(CURRENT_SESSION, "2099-01", ACTOR);
    expect(second.created).toBe(0);
    expect(second.skippedExisting).toBe(first.created);
    expect(getSnapshot().transportFeeCharges.length).toBe(before);
  });
});

describe("recordChargePayment / waiveCharge", () => {
  beforeEach(() => resetDemoData());

  it("moves a charge from pending to partial to paid as payments accumulate", () => {
    generateChargesForPeriod(CURRENT_SESSION, "2099-02", ACTOR);
    const charge = getSnapshot().transportFeeCharges.find((c) => c.period === "2099-02");
    expect(charge).toBeDefined();
    if (!charge) return;

    const half = moneyFromMajor(charge.billedAmount.minorUnits / 200, "INR");
    recordChargePayment(charge.id, half, ACTOR);
    expect(getSnapshot().transportFeeCharges.find((c) => c.id === charge.id)?.status).toBe("partial");

    recordChargePayment(charge.id, half, ACTOR);
    expect(getSnapshot().transportFeeCharges.find((c) => c.id === charge.id)?.status).toBe("paid");
  });

  it("refuses payment against a non-existent charge", () => {
    expect(recordChargePayment("no-such-charge", moneyFromMajor(100, "INR"), ACTOR).ok).toBe(false);
  });

  it("waives a charge and blocks further payment against it", () => {
    generateChargesForPeriod(CURRENT_SESSION, "2099-03", ACTOR);
    const charge = getSnapshot().transportFeeCharges.find((c) => c.period === "2099-03");
    if (!charge) return;
    expect(waiveCharge(charge.id, "Financial hardship", ACTOR).ok).toBe(true);
    expect(getSnapshot().transportFeeCharges.find((c) => c.id === charge.id)?.status).toBe("waived");
    expect(recordChargePayment(charge.id, moneyFromMajor(100, "INR"), ACTOR).ok).toBe(false);
  });
});
