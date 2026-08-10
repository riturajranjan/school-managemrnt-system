// Mock-removal verification (Backend Phase 4). The admissions/applications mock
// slice has been migrated to PostgreSQL and removed from the store, while the
// student slice remains as the backbone still consumed by not-yet-migrated
// modules (fees, transport, exams, health, …). See the phase report.
import { describe, expect, it } from "vitest";
import { getSnapshot } from "@/lib/data/store";

describe("Phase 4 mock removal", () => {
  it("no longer exposes an admissions/applications slice on the store", () => {
    const db = getSnapshot() as Record<string, unknown>;
    expect("applications" in db).toBe(false);
  });

  it("keeps the student slice (still used by unmigrated modules)", () => {
    const db = getSnapshot();
    expect(Array.isArray(db.students)).toBe(true);
  });

  it("has no importable admissions/parents mock service modules", async () => {
    // A resolvable import here would mean the fake-CRUD service still exists.
    await expect(import("@/lib/services/admissions-service" as string)).rejects.toBeDefined();
    await expect(import("@/lib/services/parents-service" as string)).rejects.toBeDefined();
  });
});
