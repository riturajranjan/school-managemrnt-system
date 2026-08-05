import { setState } from "@/lib/data/store";
import type { LessonPlan, LessonPlanStatus } from "@/lib/types/academics";
import { generateId } from "@/lib/utils";

function nowIso() {
  return new Date().toISOString();
}

function mapPlan(plans: LessonPlan[], id: string, fn: (p: LessonPlan) => LessonPlan): LessonPlan[] {
  return plans.map((p) => (p.id === id ? { ...fn(p), updatedAt: nowIso() } : p));
}

export function createLessonPlan(data: Omit<LessonPlan, "id" | "status" | "attachments" | "createdAt" | "updatedAt">): LessonPlan {
  const plan: LessonPlan = { ...data, id: generateId("lp"), status: "draft", attachments: [], createdAt: nowIso(), updatedAt: nowIso() };
  setState((db) => ({ ...db, lessonPlans: [plan, ...db.lessonPlans] }));
  return plan;
}

export function updateLessonPlan(id: string, patch: Partial<LessonPlan>) {
  setState((db) => ({ ...db, lessonPlans: mapPlan(db.lessonPlans, id, (p) => ({ ...p, ...patch })) }));
}

export function submitForApproval(id: string) {
  updateLessonPlan(id, { status: "submitted" });
}

export function approveLessonPlan(id: string, reviewedBy: string, comment?: string) {
  updateLessonPlan(id, { status: "approved", reviewedBy, reviewComment: comment });
}

export function rejectLessonPlan(id: string, reviewedBy: string, comment: string) {
  updateLessonPlan(id, { status: "rejected", reviewedBy, reviewComment: comment });
}

export function markLessonPlanCompleted(id: string, note?: string) {
  updateLessonPlan(id, { status: "completed", notes: note });
}

export function rescheduleLessonPlan(id: string, date: string, period: number) {
  updateLessonPlan(id, { status: "rescheduled", date, period });
}

export function bulkApprove(ids: string[], reviewedBy: string) {
  setState((db) => ({
    ...db,
    lessonPlans: db.lessonPlans.map((p) => (ids.includes(p.id) ? { ...p, status: "approved" as LessonPlanStatus, reviewedBy, updatedAt: nowIso() } : p)),
  }));
}

export function duplicateLessonPlan(id: string, newDate: string): LessonPlan | undefined {
  let created: LessonPlan | undefined;
  setState((db) => {
    const source = db.lessonPlans.find((p) => p.id === id);
    if (!source) return db;
    created = { ...source, id: generateId("lp"), date: newDate, status: "draft", createdAt: nowIso(), updatedAt: nowIso(), reviewComment: undefined };
    return { ...db, lessonPlans: [created, ...db.lessonPlans] };
  });
  return created;
}

export type AiLessonPlanDraft = {
  learningObjective: string;
  activity: string;
  homework: string;
  assessmentMethod: string;
  differentiationPlan: string;
  materials: string;
};

// Deterministic, template-based "AI assist" — no external model call in this
// build. Returns a fully editable draft; nothing here writes to a lesson
// plan record, so a teacher must explicitly accept/edit before it's saved.
export function generateAiLessonPlanDraft(subjectName: string, topic: string): AiLessonPlanDraft {
  return {
    learningObjective: `By the end of the lesson, students will be able to explain and apply the key ideas of "${topic}" in ${subjectName}.`,
    activity: `Warm-up recap (5 min) → guided explanation of ${topic} with worked examples (15 min) → paired practice (15 min) → independent exercise and exit-ticket review (10 min).`,
    homework: `Complete 5 practice questions on ${topic} and write a 3-sentence summary of today's key idea.`,
    assessmentMethod: `Exit ticket: 2 quick questions checking understanding of ${topic}, reviewed at the start of the next class.`,
    differentiationPlan: `Provide worked-example scaffolds for students who need support; offer an extension problem on ${topic} for early finishers.`,
    materials: `Textbook chapter, whiteboard, printed practice worksheet on ${topic}.`,
  };
}
