import { describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { computePromotionEligibility } from "@/lib/services/promotion-service";
import { computePromotionReadiness } from "./promotion-readiness";

describe("computePromotionReadiness", () => {
  it("blocks starting a run when every student is missing a result", () => {
    resetDemoData();
    const db = getSnapshot();
    const classWithoutResults = db.classes.find((c) => !db.examResults.some((r) => r.classId === c.id));
    if (!classWithoutResults) return;
    const eligibility = computePromotionEligibility(db, classWithoutResults.id);
    const readiness = computePromotionReadiness(db, classWithoutResults.id, "2026-2027", "2027-2028", eligibility);
    expect(readiness.canStartRun).toBe(false);
    expect(readiness.blockingIssues.length).toBeGreaterThan(0);
  });

  it("allows starting a run when at least one student has a calculated result", () => {
    resetDemoData();
    const db = getSnapshot();
    const classWithResults = db.classes.find((c) => db.examResults.some((r) => r.classId === c.id && db.students.some((s) => s.id === r.studentId && s.status === "active")));
    if (!classWithResults) return;
    const eligibility = computePromotionEligibility(db, classWithResults.id);
    const readiness = computePromotionReadiness(db, classWithResults.id, "2026-2027", "2027-2028", eligibility);
    expect(readiness.canStartRun).toBe(true);
  });

  it("reports the default rule thresholds when no promotion rule is configured", () => {
    resetDemoData();
    const db = getSnapshot();
    const someClass = db.classes[0];
    if (!someClass) return;
    const eligibility = computePromotionEligibility(db, someClass.id);
    const readiness = computePromotionReadiness(db, someClass.id, "2026-2027", "2027-2028", eligibility);
    expect(readiness.promotionThreshold).toBe(33);
    expect(readiness.attendanceThreshold).toBe(75);
    expect(readiness.maxFailedSubjects).toBe(2);
  });
});
