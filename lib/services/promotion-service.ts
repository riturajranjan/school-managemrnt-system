import { getSnapshot, setState, type Db } from "@/lib/data/store";
import type { PromotionDecision, PromotionDecisionType, PromotionRule, PromotionRun } from "@/lib/types/promotion";
import { updateStudent } from "./students-service";
import { generateId } from "@/lib/utils";
import { logExamAudit } from "./exam-audit-service";

export const DEFAULT_PROMOTION_RULE: Pick<PromotionRule, "minOverallPercent" | "maxFailedSubjects" | "minAttendancePercent"> = {
  minOverallPercent: 33,
  maxFailedSubjects: 2,
  minAttendancePercent: 75,
};

export type PromotionEligibility = {
  studentId: string;
  currentClassId: string;
  currentSectionId: string;
  resultPercent?: number;
  failedSubjectCount?: number;
  attendancePercent: number;
  decision: PromotionDecisionType;
  reason: string;
};

export function computePromotionEligibility(db: Db, classId: string, ruleId?: string): PromotionEligibility[] {
  const rule = db.promotionRules.find((r) => r.id === ruleId) ?? DEFAULT_PROMOTION_RULE;
  const students = db.students.filter((s) => s.classId === classId && s.status === "active");

  return students.map((student) => {
    const latestResult = [...db.examResults]
      .filter((r) => r.studentId === student.id)
      .sort((a, b) => (a.calculatedAt < b.calculatedAt ? 1 : -1))[0];
    const attendancePercent = student.attendance.presentPercent;

    if (!latestResult) {
      return { studentId: student.id, currentClassId: student.classId, currentSectionId: student.sectionId, attendancePercent, decision: "pending", reason: "No exam result found yet." };
    }

    const failsAcademics = latestResult.failedSubjectCount > rule.maxFailedSubjects || (rule.minOverallPercent !== undefined && latestResult.percent < rule.minOverallPercent);
    if (failsAcademics) {
      return {
        studentId: student.id,
        currentClassId: student.classId,
        currentSectionId: student.sectionId,
        resultPercent: latestResult.percent,
        failedSubjectCount: latestResult.failedSubjectCount,
        attendancePercent,
        decision: "retain",
        reason: `${latestResult.failedSubjectCount} subject(s) below passing, or overall ${latestResult.percent}% below the ${rule.minOverallPercent ?? 0}% threshold.`,
      };
    }

    const failsAttendance = rule.minAttendancePercent !== undefined && attendancePercent < rule.minAttendancePercent;
    if (failsAttendance) {
      return {
        studentId: student.id,
        currentClassId: student.classId,
        currentSectionId: student.sectionId,
        resultPercent: latestResult.percent,
        failedSubjectCount: latestResult.failedSubjectCount,
        attendancePercent,
        decision: "conditional-promotion",
        reason: `Academically eligible, but attendance ${attendancePercent}% is below the ${rule.minAttendancePercent}% threshold.`,
      };
    }

    return {
      studentId: student.id,
      currentClassId: student.classId,
      currentSectionId: student.sectionId,
      resultPercent: latestResult.percent,
      failedSubjectCount: latestResult.failedSubjectCount,
      attendancePercent,
      decision: "promote",
      reason: `${latestResult.percent}% overall, ${failedSubjectCount(latestResult)} subject(s) below passing, ${attendancePercent}% attendance — meets all thresholds.`,
    };
  });
}

function failedSubjectCount(result: { failedSubjectCount: number }) {
  return result.failedSubjectCount;
}

export function createPromotionRun(fromSession: string, toSession: string, classId: string, ruleId: string | undefined, actor: { name: string; role: string }): PromotionRun {
  const db = getSnapshot();
  const eligibility = computePromotionEligibility(db, classId, ruleId);

  // Service-layer guard mirroring the readiness panel's block on the hub page — a run
  // with zero students carrying a real result is not a promotion run, it's a blind guess.
  if (eligibility.length > 0 && eligibility.every((e) => e.decision === "pending")) {
    throw new Error("Cannot start a promotion run: no student in this class has a calculated result yet.");
  }

  const decisions: PromotionDecision[] = eligibility.map((e) => ({
    id: generateId("pd"),
    runId: "", // filled in below once the run id is known
    studentId: e.studentId,
    fromClassId: e.currentClassId,
    fromSectionId: e.currentSectionId,
    decision: e.decision,
    originalDecision: e.decision,
    reason: e.reason,
  }));

  const run: PromotionRun = { id: generateId("promrun"), fromSession, toSession, classId, ruleId, status: "draft", decisions: [], createdBy: actor.name, createdAt: new Date().toISOString() };
  run.decisions = decisions.map((d) => ({ ...d, runId: run.id }));

  setState((current) => ({ ...current, promotionRuns: [...current.promotionRuns, run] }));
  return run;
}

export function updateDecision(runId: string, studentId: string, patch: Partial<Omit<PromotionDecision, "id" | "runId" | "studentId">>, actor?: { name: string }) {
  setState((db) => ({
    ...db,
    promotionRuns: db.promotionRuns.map((run) =>
      run.id === runId
        ? {
            ...run,
            decisions: run.decisions.map((d) => {
              if (d.studentId !== studentId) return d;
              const next = { ...d, ...patch };
              // Track whether the decision now differs from what the eligibility engine
              // originally computed — this is what "manual override" means here.
              if (patch.decision !== undefined) {
                next.overriddenBy = patch.decision !== d.originalDecision ? (actor?.name ?? "Unknown") : undefined;
              }
              return next;
            }),
          }
        : run,
    ),
  }));
}

export function setRunStatus(runId: string, status: PromotionRun["status"]) {
  setState((db) => ({ ...db, promotionRuns: db.promotionRuns.map((r) => (r.id === runId ? { ...r, status } : r)) }));
}

export type ConfirmPromotionResult = { ok: true; promoted: number } | { ok: false; errors: string[] };

export function confirmPromotionRun(runId: string, actor: { name: string; role: string }): ConfirmPromotionResult {
  const db = getSnapshot();
  const run = db.promotionRuns.find((r) => r.id === runId);
  if (!run) return { ok: false, errors: ["Promotion run not found."] };

  const errors: string[] = [];
  const rollNumbersBySection = new Map<string, number>();

  for (const decision of run.decisions) {
    if (decision.decision === "promote" || decision.decision === "conditional-promotion") {
      if (!decision.toClassId || !decision.toSectionId) {
        errors.push(`${decision.studentId}: destination class/section not set.`);
        continue;
      }
      const targetSection = db.classes.flatMap((c) => c.sections).find((s) => s.id === decision.toSectionId);
      if (!targetSection) {
        errors.push(`${decision.studentId}: destination section no longer exists.`);
        continue;
      }
      const currentCount = rollNumbersBySection.get(decision.toSectionId) ?? targetSection.enrolledCount;
      if (currentCount + 1 > targetSection.capacity) {
        errors.push(`${targetSection.name}: destination section is at capacity.`);
        continue;
      }
      rollNumbersBySection.set(decision.toSectionId, currentCount + 1);
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  let promoted = 0;
  for (const decision of run.decisions) {
    if ((decision.decision === "promote" || decision.decision === "conditional-promotion") && decision.toClassId && decision.toSectionId) {
      updateStudent(decision.studentId, { classId: decision.toClassId, sectionId: decision.toSectionId, session: run.toSession, rollNumber: decision.newRollNumber }, actor.name);
      promoted += 1;
    } else if (decision.decision === "graduate") {
      updateStudent(decision.studentId, { status: "alumni" }, actor.name);
    } else if (decision.decision === "withdraw") {
      updateStudent(decision.studentId, { status: "archived" }, actor.name);
    }
    // "retain" and "pending" — deliberately no mutation; the student simply isn't moved forward.
  }

  setState((current) => ({ ...current, promotionRuns: current.promotionRuns.map((r) => (r.id === runId ? { ...r, status: "completed", confirmedBy: actor.name, confirmedAt: new Date().toISOString() } : r)) }));
  logExamAudit({ action: "student-promoted", actorName: actor.name, actorRole: actor.role, summary: `Promotion run confirmed: ${promoted} student(s) moved from ${run.fromSession} to ${run.toSession}.` });

  return { ok: true, promoted };
}
