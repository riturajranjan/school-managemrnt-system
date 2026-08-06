import type { Db } from "@/lib/data/store";
import { DEFAULT_PROMOTION_RULE, type PromotionEligibility } from "@/lib/services/promotion-service";

export type PromotionReadiness = {
  currentSession: string;
  destinationSession: string;
  currentClassName: string;
  destinationClassName?: string;
  promotionThreshold?: number;
  attendanceThreshold?: number;
  maxFailedSubjects: number;
  destinationCapacityTotal: number;
  destinationCapacityRemaining: number;
  studentCount: number;
  missingResultCount: number;
  missingAttendanceCount: number;
  exceptionCount: number;
  blockingIssues: string[];
  canStartRun: boolean;
};

/** Everything the promotion hub needs to show — and enforce — before a run is allowed
 * to start: the applicable rule thresholds, destination capacity, and gaps in the
 * underlying result/attendance data that would make a run meaningless. */
export function computePromotionReadiness(db: Db, classId: string, fromSession: string, toSession: string, eligibility: PromotionEligibility[], ruleId?: string): PromotionReadiness {
  const currentClass = db.classes.find((c) => c.id === classId);
  const destinationClass = db.classes.find((c) => c.order === (currentClass?.order ?? 0) + 1);
  const rule = db.promotionRules.find((r) => r.id === ruleId) ?? DEFAULT_PROMOTION_RULE;

  const destinationCapacityTotal = destinationClass?.sections.reduce((sum, s) => sum + s.capacity, 0) ?? 0;
  const destinationCapacityRemaining = destinationClass?.sections.reduce((sum, s) => sum + Math.max(s.capacity - s.enrolledCount, 0), 0) ?? 0;

  const missingResultCount = eligibility.filter((e) => e.resultPercent === undefined).length;
  const missingAttendanceCount = eligibility.filter((e) => {
    const student = db.students.find((s) => s.id === e.studentId);
    return student ? student.attendance.totalDays === 0 : false;
  }).length;
  const exceptionCount = eligibility.filter((e) => e.decision === "conditional-promotion").length;
  const forwardBoundCount = eligibility.filter((e) => e.decision === "promote" || e.decision === "conditional-promotion").length;

  const blockingIssues: string[] = [];
  if (eligibility.length === 0) blockingIssues.push("No active students found in this class.");
  else if (missingResultCount === eligibility.length) blockingIssues.push("No student in this class has a calculated result yet — results must be published before promoting.");
  else if (missingResultCount > 0) blockingIssues.push(`${missingResultCount} student(s) are missing a calculated result and will be marked pending.`);
  if (!destinationClass) blockingIssues.push("No destination class found above this one — confirm this is the graduating class before proceeding.");
  else if (forwardBoundCount > destinationCapacityRemaining) {
    blockingIssues.push(`Destination class has only ${destinationCapacityRemaining} seat(s) remaining but ${forwardBoundCount} student(s) are eligible to move forward.`);
  }

  const canStartRun = eligibility.length > 0 && missingResultCount < eligibility.length;

  return {
    currentSession: fromSession,
    destinationSession: toSession,
    currentClassName: currentClass?.name ?? classId,
    destinationClassName: destinationClass?.name,
    promotionThreshold: rule.minOverallPercent,
    attendanceThreshold: rule.minAttendancePercent,
    maxFailedSubjects: rule.maxFailedSubjects,
    destinationCapacityTotal,
    destinationCapacityRemaining,
    studentCount: eligibility.length,
    missingResultCount,
    missingAttendanceCount,
    exceptionCount,
    blockingIssues,
    canStartRun,
  };
}
