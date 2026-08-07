import { describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { documentCompliance, effectiveDocumentStatus, isDriverAssignmentBlocked, isVehicleAssignmentBlocked } from "./document-compliance";

describe("effectiveDocumentStatus", () => {
  it("recomputes expired/expiring-soon/valid from the expiry date rather than trusting a stale stored status", () => {
    const past = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const soon = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const far = new Date(Date.now() + 200 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    expect(effectiveDocumentStatus("valid", past)).toBe("expired");
    expect(effectiveDocumentStatus("expired", soon)).toBe("expiring-soon");
    expect(effectiveDocumentStatus("valid", far)).toBe("valid");
  });

  it("leaves manual workflow states (under-review, rejected, missing) untouched regardless of expiry", () => {
    expect(effectiveDocumentStatus("under-review", "2020-01-01")).toBe("under-review");
    expect(effectiveDocumentStatus("rejected", "2020-01-01")).toBe("rejected");
    expect(effectiveDocumentStatus("missing")).toBe("missing");
  });
});

describe("documentCompliance", () => {
  it("flags the seeded expired fitness-certificate vehicle and expired-license driver as blocked", () => {
    resetDemoData();
    const db = getSnapshot();
    const result = documentCompliance(db);
    expect(result.expiredCount).toBeGreaterThan(0);
    expect(result.blockedVehicles.length).toBeGreaterThan(0);
    expect(result.blockedDrivers.length).toBeGreaterThan(0);
  });

  it("agrees with isVehicleAssignmentBlocked / isDriverAssignmentBlocked helpers", () => {
    resetDemoData();
    const db = getSnapshot();
    const result = documentCompliance(db);
    for (const row of result.vehicleRows) {
      expect(isVehicleAssignmentBlocked(db, row.vehicleId)).toBe(row.blocked);
    }
    for (const row of result.driverRows) {
      expect(isDriverAssignmentBlocked(db, row.driverId)).toBe(row.blocked);
    }
  });
});
