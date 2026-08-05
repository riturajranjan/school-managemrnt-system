import { schoolClasses } from "@/lib/data/seed/reference";
import type { AdmissionApplication, AdmissionStageKey } from "@/lib/types/admissions";
import { admissionSourceLabels, forwardStageOrder } from "@/lib/types/admissions";

export function countByStage(applications: AdmissionApplication[]): Record<AdmissionStageKey, number> {
  const counts = {} as Record<AdmissionStageKey, number>;
  for (const key of Object.keys({
    "new-enquiry": 0,
    "application-started": 0,
    "documents-pending": 0,
    "under-review": 0,
    "interview-scheduled": 0,
    approved: 0,
    "fee-pending": 0,
    enrolled: 0,
    rejected: 0,
    waitlisted: 0,
  }) as AdmissionStageKey[]) {
    counts[key] = 0;
  }
  for (const app of applications) counts[app.stage] += 1;
  return counts;
}

export function applicationsReceivedThisWeek(applications: AdmissionApplication[], nowIso = new Date().toISOString()): number {
  const now = new Date(nowIso).getTime();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  return applications.filter((a) => now - new Date(a.createdAt).getTime() <= weekMs).length;
}

/** Enrolled ÷ (everything past the pure-enquiry stage), as a whole-number percent. */
export function conversionRate(applications: AdmissionApplication[]): number {
  const eligible = applications.filter((a) => a.stage !== "new-enquiry");
  if (eligible.length === 0) return 0;
  const enrolled = applications.filter((a) => a.stage === "enrolled").length;
  return Math.round((enrolled / eligible.length) * 100);
}

export function averageProcessingDays(applications: AdmissionApplication[], nowIso = new Date().toISOString()): number {
  const resolved = applications.filter((a) => a.stage === "enrolled" || a.stage === "rejected");
  if (resolved.length === 0) return 0;
  const now = new Date(nowIso).getTime();
  const totalDays = resolved.reduce((sum, a) => sum + (now - new Date(a.createdAt).getTime()) / 86400000, 0);
  return Math.round(totalDays / resolved.length);
}

export function mostRequestedClass(applications: AdmissionApplication[]): string {
  const counts = new Map<string, number>();
  for (const app of applications) counts.set(app.appliedClassId, (counts.get(app.appliedClassId) ?? 0) + 1);
  let topId: string | undefined;
  let topCount = -1;
  for (const [id, count] of counts) {
    if (count > topCount) {
      topCount = count;
      topId = id;
    }
  }
  return schoolClasses.find((c) => c.id === topId)?.name ?? "—";
}

export function missingDocumentCount(applications: AdmissionApplication[]): number {
  return applications.reduce(
    (sum, app) => sum + app.documents.filter((d) => d.status === "missing" || d.status === "re-upload-requested").length,
    0,
  );
}

export function pendingInterviewCount(applications: AdmissionApplication[]): number {
  return applications.filter((a) => a.interview?.status === "scheduled").length;
}

export function feePendingApprovalCount(applications: AdmissionApplication[]): number {
  return applications.filter((a) => a.stage === "fee-pending").length;
}

export function sourcePerformance(applications: AdmissionApplication[]): { source: string; count: number; enrolled: number }[] {
  const map = new Map<string, { count: number; enrolled: number }>();
  for (const app of applications) {
    const entry = map.get(app.source) ?? { count: 0, enrolled: 0 };
    entry.count += 1;
    if (app.stage === "enrolled") entry.enrolled += 1;
    map.set(app.source, entry);
  }
  return [...map.entries()]
    .map(([source, v]) => ({ source: admissionSourceLabels[source as keyof typeof admissionSourceLabels] ?? source, ...v }))
    .sort((a, b) => b.count - a.count);
}

export type SeatCapacityWarning = { classId: string; className: string; capacity: number; applied: number; remaining: number };

export function seatCapacityWarnings(applications: AdmissionApplication[]): SeatCapacityWarning[] {
  const warnings: SeatCapacityWarning[] = [];
  for (const schoolClass of schoolClasses) {
    const capacity = schoolClass.sections.reduce((sum, s) => sum + s.capacity, 0);
    const alreadyEnrolled = schoolClass.sections.reduce((sum, s) => sum + s.enrolledCount, 0);
    const activeApplications = applications.filter(
      (a) => a.appliedClassId === schoolClass.id && forwardStageOrder.includes(a.stage) && a.stage !== "enrolled",
    ).length;
    const remaining = capacity - alreadyEnrolled - activeApplications;
    if (remaining <= 5) {
      warnings.push({ classId: schoolClass.id, className: schoolClass.name, capacity, applied: activeApplications, remaining: Math.max(0, remaining) });
    }
  }
  return warnings.sort((a, b) => a.remaining - b.remaining);
}

export function applicationsRequiringAction(applications: AdmissionApplication[]): number {
  return applications.filter((a) => {
    const hasMissingDocs = a.documents.some((d) => d.status === "missing" || d.status === "re-upload-requested");
    const interviewDue = a.interview?.status === "scheduled" && new Date(a.interview.scheduledAt).getTime() < Date.now();
    const stale = ["documents-pending", "under-review"].includes(a.stage) && Date.now() - new Date(a.updatedAt).getTime() > 5 * 86400000;
    return hasMissingDocs || interviewDue || stale;
  }).length;
}
