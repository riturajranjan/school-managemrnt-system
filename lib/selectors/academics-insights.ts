import type { CurriculumUnit, Homework, HomeworkSubmission, LessonPlan } from "@/lib/types/academics";
import type { Db } from "@/lib/data/store";

export function curriculumCompletionPercent(units: CurriculumUnit[]): number {
  if (units.length === 0) return 0;
  const total = units.reduce((sum, u) => sum + u.estimatedPeriods, 0);
  const done = units.reduce((sum, u) => sum + u.completedPeriods, 0);
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

export function delayedUnitCount(units: CurriculumUnit[]): number {
  return units.filter((u) => u.status === "delayed").length;
}

export function lessonPlanAdherencePercent(plans: LessonPlan[]): number {
  const relevant = plans.filter((p) => ["completed", "missed", "approved", "scheduled"].includes(p.status));
  if (relevant.length === 0) return 100;
  const onTrack = relevant.filter((p) => p.status === "completed" || p.status === "approved" || p.status === "scheduled").length;
  return Math.round((onTrack / relevant.length) * 100);
}

export function missingLessonPlanCount(plans: LessonPlan[], daysAheadWindow = 2): number {
  const now = Date.now();
  const windowMs = daysAheadWindow * 86400000;
  return plans.filter((p) => {
    const date = new Date(p.date).getTime();
    return date >= now && date <= now + windowMs && p.status === "draft";
  }).length;
}

export function homeworkCompletionPercent(homework: Homework[], submissions: HomeworkSubmission[]): number {
  const published = homework.filter((h) => h.status !== "draft" && h.status !== "scheduled");
  if (published.length === 0) return 0;
  const relevantSubmissions = submissions.filter((s) => published.some((h) => h.id === s.homeworkId));
  if (relevantSubmissions.length === 0) return 0;
  const done = relevantSubmissions.filter((s) => s.status === "submitted" || s.status === "evaluated" || s.status === "late").length;
  return Math.round((done / relevantSubmissions.length) * 100);
}

export function overdueHomeworkForReviewCount(homework: Homework[], submissions: HomeworkSubmission[]): number {
  return homework.filter((h) => {
    if (h.status !== "overdue" && h.status !== "published") return false;
    return submissions.some((s) => s.homeworkId === h.id && s.status === "submitted");
  }).length;
}

export function pendingLessonPlanApprovals(plans: LessonPlan[]): number {
  return plans.filter((p) => p.status === "submitted").length;
}

export function substituteRequirementCount(db: Db): number {
  const onLeaveTeacherIds = new Set(
    db.leaveRequests.filter((l) => l.applicantType === "staff" && l.status === "approved").map((l) => l.applicantId),
  );
  return db.teachers.filter((t) => t.status === "on-leave" || onLeaveTeacherIds.has(t.id)).length;
}
