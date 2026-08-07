import type { Db } from "@/lib/data/store";

export type PeoplePulseFactor = { key: string; label: string; score: number; displayValue: string; tone: "success" | "warning" | "error" };
export type PeoplePulse = { score: number; factors: PeoplePulseFactor[] };

function toneFor(score: number): "success" | "warning" | "error" {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "error";
}

const TODAY = () => new Date().toISOString().slice(0, 10);

/** Composite 0-100 workforce-health score. Every factor derives from live mock
 * state — attendance, staffing, leave, recruitment, onboarding, contracts,
 * training, review readiness. Unweighted average, same shape as prior pulses. */
export function computePeoplePulse(db: Db): PeoplePulse {
  const today = TODAY();
  const activeStaff = db.employees.filter((e) => e.status !== "inactive" && e.status !== "resigned" && e.status !== "retired");

  const todaysAttendance = db.hrAttendance.filter((a) => a.date === today);
  const presentish = todaysAttendance.filter((a) => a.status === "present" || a.status === "late" || a.status === "work-from-home" || a.status === "official-duty" || a.status === "half-day").length;
  const attendanceScore = todaysAttendance.length > 0 ? Math.round((presentish / todaysAttendance.length) * 100) : 100;

  const openings = db.recruitmentJobs.filter((j) => j.status === "open").reduce((s, j) => s + j.openings, 0);
  const staffingScore = activeStaff.length + openings > 0 ? Math.round((activeStaff.length / (activeStaff.length + openings)) * 100) : 100;

  const onLeave = db.employees.filter((e) => e.status === "on-leave").length;
  const leaveScore = activeStaff.length > 0 ? Math.round((1 - onLeave / activeStaff.length) * 100) : 100;

  const activeCandidates = db.candidates.filter((c) => c.stage !== "rejected" && c.stage !== "hired");
  const progressing = activeCandidates.filter((c) => c.stage !== "applied").length;
  const recruitmentScore = activeCandidates.length > 0 ? Math.round((progressing / activeCandidates.length) * 100) : 100;

  const onboarding = db.onboardingTasks;
  const onboardingScore = onboarding.length > 0 ? Math.round((onboarding.filter((t) => t.completed).length / onboarding.length) * 100) : 100;

  const contracts = db.contracts;
  const compliant = contracts.filter((c) => c.status === "active").length;
  const contractScore = contracts.length > 0 ? Math.round((compliant / contracts.length) * 100) : 100;

  const mandatoryEnrollments = db.trainingEnrollments.filter((e) => db.trainingCourses.find((c) => c.id === e.courseId)?.mandatory);
  const trainingDone = mandatoryEnrollments.filter((e) => e.status === "completed").length;
  const trainingScore = mandatoryEnrollments.length > 0 ? Math.round((trainingDone / mandatoryEnrollments.length) * 100) : 100;

  const reviews = db.performanceReviews;
  const advanced = reviews.filter((r) => r.stage !== "self-review").length;
  const reviewScore = reviews.length > 0 ? Math.round((advanced / reviews.length) * 100) : 100;

  const factors: PeoplePulseFactor[] = [
    { key: "attendance", label: "Attendance health", score: attendanceScore, displayValue: `${presentish}/${todaysAttendance.length} in`, tone: toneFor(attendanceScore) },
    { key: "staffing", label: "Staffing coverage", score: staffingScore, displayValue: `${openings} open`, tone: toneFor(staffingScore) },
    { key: "leave", label: "Leave load", score: leaveScore, displayValue: `${onLeave} on leave`, tone: toneFor(leaveScore) },
    { key: "recruitment", label: "Recruitment health", score: recruitmentScore, displayValue: `${progressing}/${activeCandidates.length} moving`, tone: toneFor(recruitmentScore) },
    { key: "onboarding", label: "Onboarding completion", score: onboardingScore, displayValue: `${onboardingScore}%`, tone: toneFor(onboardingScore) },
    { key: "contracts", label: "Contract compliance", score: contractScore, displayValue: `${contracts.length - compliant} at risk`, tone: toneFor(contractScore) },
    { key: "training", label: "Training completion", score: trainingScore, displayValue: `${trainingDone}/${mandatoryEnrollments.length}`, tone: toneFor(trainingScore) },
    { key: "reviews", label: "Review readiness", score: reviewScore, displayValue: `${advanced}/${reviews.length}`, tone: toneFor(reviewScore) },
  ];

  const score = Math.max(0, Math.min(100, Math.round(factors.reduce((sum, f) => sum + f.score, 0) / factors.length)));
  return { score, factors };
}
