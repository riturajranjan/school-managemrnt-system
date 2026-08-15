// Lesson Plans (Phase 9C.2) — real, PostgreSQL-backed. One LessonPlan targets
// exactly one real Section+Subject on one real teacher's TeachingAssignment,
// on one real plannedDate. Optional real CurriculumTopic links (never a free-
// floating topic name) — every linked topic must belong to the ACTIVE
// curriculum for this section's class + this subject (lib/server/curriculum/
// service.ts's listAssignableCurriculumTopics is the single source of truth
// for "what topics are valid here").
//
// AUTHORSHIP: mirrors lib/server/homework/service.ts exactly — CREATE requires
// the actor themselves to hold the real TeachingAssignment (no impersonation);
// SCHOOL_ADMIN/PRINCIPAL are broad managers for EDIT/SUBMIT/APPROVE/REJECT/
// COMPLETE/DUPLICATE on ANY teacher's plan. Approve/reject is a broad-manager-
// only action gated by the SAME lessonPlans.manage key (no separate "approve"
// permission — the existing UI's Approve/Reject buttons are just a subset of
// "manage" a broad manager already has, exactly like Homework's publish/close).
//
// LIFECYCLE: DRAFT -> SUBMITTED -> APPROVED -> COMPLETED, with REJECTED as a
// dead-end that only a new edit+resubmit escapes. Only DRAFT/REJECTED plans
// are editable; the update schema has no section/subject/staff fields at all
// (impossible by construction, not just runtime-rejected).
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ListMeta } from "@/lib/server/api/response";
import type { LessonPlanDetailDto, LessonPlanListItemDto, LessonPlanStatusDto } from "@/lib/api/contracts";
import { getCurrentStaffProfile } from "@/lib/server/staff/service";
import { listAssignableCurriculumTopics } from "@/lib/server/curriculum/service";
import { createNotification } from "@/lib/server/notifications/service";

function requireSession(scope: OrgScope): string {
  if (!scope.academicSessionId) throw new HttpError("INVALID_SESSION", "Select an academic session first");
  return scope.academicSessionId;
}

const STATUS_TO_DB: Record<LessonPlanStatusDto, string> = { draft: "DRAFT", submitted: "SUBMITTED", approved: "APPROVED", rejected: "REJECTED", completed: "COMPLETED" };
const statusToUi = (s: string): LessonPlanStatusDto => s.toLowerCase() as LessonPlanStatusDto;
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
const dateToUi = (d: Date) => d.toISOString().slice(0, 10);

// ── Authorization (mirrors homework-service.ts's isBroadHomeworkManager) ────

async function isBroadLessonPlanManager(scope: OrgScope): Promise<boolean> {
  const m = await prisma.roleAssignment.findFirst({
    where: { membership: { userId: scope.actor.id, tenantId: scope.tenantId, status: "ACTIVE" }, role: { key: { in: ["SCHOOL_ADMIN", "PRINCIPAL"] } } },
    select: { id: true },
  });
  return Boolean(m);
}

async function assertCanManage(scope: OrgScope, staffId: string): Promise<void> {
  if (await isBroadLessonPlanManager(scope)) return;
  const staff = await getCurrentStaffProfile(scope);
  if (!staff || staff.id !== staffId) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
}

// ── DTO ──────────────────────────────────────────────────────────────────

const listSelect = {
  id: true, title: true, status: true, plannedDate: true, period: true, learningObjective: true, createdAt: true, updatedAt: true,
  section: { select: { id: true, name: true, classId: true, class: { select: { name: true } } } },
  subject: { select: { id: true, code: true, name: true, color: true } },
  staff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
  topics: { select: { topicId: true } },
} satisfies Prisma.LessonPlanSelect;
type ListRow = Prisma.LessonPlanGetPayload<{ select: typeof listSelect }>;

function staffName(s: { firstName: string; lastName: string | null; displayName: string | null }): string {
  return s.displayName?.trim() || `${s.firstName} ${s.lastName ?? ""}`.trim();
}

type ListItemBase = Omit<ListRow, "topics">;
function listItemDto(row: ListItemBase, topicCount: number): LessonPlanListItemDto {
  return {
    id: row.id, title: row.title, status: statusToUi(row.status), plannedDate: dateToUi(row.plannedDate), period: row.period,
    section: { id: row.section.id, name: row.section.name, classId: row.section.classId, className: row.section.class.name },
    subject: { id: row.subject.id, code: row.subject.code, name: row.subject.name, color: row.subject.color },
    teacher: { id: row.staff.id, name: staffName(row.staff) }, learningObjective: row.learningObjective,
    topicCount, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}

// ── List / detail ────────────────────────────────────────────────────────

export const listLessonPlansSchema = z.object({
  sectionId: z.string().min(1).optional(),
  subjectId: z.string().min(1).optional(),
  staffId: z.string().min(1).optional(),
  status: z.enum(["draft", "submitted", "approved", "rejected", "completed"]).optional(),
  dateFrom: dateStr.optional(),
  dateTo: dateStr.optional(),
  search: z.string().trim().min(1).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export async function listLessonPlans(scope: OrgScope, raw: unknown): Promise<{ data: LessonPlanListItemDto[]; meta: ListMeta }> {
  const input = parseInput(listLessonPlansSchema, raw);
  const where: Prisma.LessonPlanWhereInput = {
    schoolId: scope.schoolId, academicSessionId: requireSession(scope),
    ...(input.sectionId ? { sectionId: input.sectionId } : {}),
    ...(input.subjectId ? { subjectId: input.subjectId } : {}),
    ...(input.staffId ? { staffId: input.staffId } : {}),
    ...(input.status ? { status: STATUS_TO_DB[input.status] as never } : {}),
    ...(input.dateFrom || input.dateTo
      ? { plannedDate: { ...(input.dateFrom ? { gte: new Date(`${input.dateFrom}T00:00:00.000Z`) } : {}), ...(input.dateTo ? { lte: new Date(`${input.dateTo}T00:00:00.000Z`) } : {}) } }
      : {}),
    ...(input.search ? { OR: [{ title: { contains: input.search, mode: "insensitive" } }, { learningObjective: { contains: input.search, mode: "insensitive" } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.lessonPlan.count({ where }),
    prisma.lessonPlan.findMany({ where, select: listSelect, orderBy: [{ plannedDate: "desc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
  ]);
  return { data: rows.map((r) => listItemDto(r, r.topics.length)), meta: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.max(1, Math.ceil(total / input.pageSize)) } };
}

/** The actor's own lesson plans — real Staff.id resolved server-side. */
export async function listMyLessonPlans(scope: OrgScope, raw: unknown): Promise<{ data: LessonPlanListItemDto[]; meta: ListMeta }> {
  const staff = await getCurrentStaffProfile(scope);
  if (!staff) return { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 } };
  return listLessonPlans(scope, { ...(raw as object), staffId: staff.id });
}

async function requireLessonPlanInScope(scope: OrgScope, lessonPlanId: string) {
  const row = await prisma.lessonPlan.findFirst({
    where: { id: lessonPlanId, schoolId: scope.schoolId, academicSessionId: requireSession(scope) },
    select: {
      ...listSelect, teachingMethod: true, materials: true, activity: true, homeworkNote: true, assessmentMethod: true, reviewComment: true,
      reviewedByName: true,
      topics: { select: { topic: { select: { id: true, title: true, chapter: { select: { title: true, unit: { select: { title: true } } } } } } } },
    },
  });
  if (!row) throw new HttpError("NOT_FOUND", "Lesson plan not found");
  return row;
}

export async function getLessonPlan(scope: OrgScope, lessonPlanId: string): Promise<LessonPlanDetailDto> {
  const row = await requireLessonPlanInScope(scope, lessonPlanId);
  return {
    ...listItemDto(row, row.topics.length), teachingMethod: row.teachingMethod, materials: row.materials, activity: row.activity,
    homeworkNote: row.homeworkNote, assessmentMethod: row.assessmentMethod, reviewComment: row.reviewComment, reviewedByName: row.reviewedByName,
    topics: row.topics.map((t) => ({ id: t.topic.id, title: t.topic.title, chapterTitle: t.topic.chapter.title, unitTitle: t.topic.chapter.unit.title })),
  };
}

// ── Create ───────────────────────────────────────────────────────────────

export const createLessonPlanSchema = z.object({
  sectionId: z.string().min(1),
  subjectId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  learningObjective: z.string().trim().min(1).max(2000),
  teachingMethod: z.string().trim().min(1).max(200),
  materials: z.string().trim().max(1000).optional(),
  activity: z.string().trim().max(2000).optional(),
  homeworkNote: z.string().trim().max(1000).optional(),
  assessmentMethod: z.string().trim().max(500).optional(),
  plannedDate: dateStr,
  period: z.number().int().min(1).max(12).optional(),
  topicIds: z.array(z.string().min(1)).max(20).optional(),
});

async function validateTopicIds(scope: OrgScope, sectionId: string, subjectId: string, topicIds: string[] | undefined): Promise<string[]> {
  if (!topicIds || topicIds.length === 0) return [];
  const valid = new Set((await listAssignableCurriculumTopics(scope, sectionId, subjectId)).map((t) => t.id));
  const foreign = topicIds.filter((id) => !valid.has(id));
  if (foreign.length > 0) throw new HttpError("INVALID_TOPIC", "One or more topics do not belong to this section's active curriculum for this subject");
  return [...new Set(topicIds)];
}

export async function createLessonPlan(scope: OrgScope, raw: unknown): Promise<LessonPlanDetailDto> {
  const input = parseInput(createLessonPlanSchema, raw);

  const staff = await getCurrentStaffProfile(scope);
  if (!staff || !staff.isTeaching) throw new HttpError("TEACHER_NOT_ASSIGNED", "Lesson plans can only be created by a real, active teaching Staff member");

  const section = await prisma.section.findFirst({ where: { id: input.sectionId, schoolId: scope.schoolId, academicSessionId: requireSession(scope), ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true, classId: true, branchId: true } });
  if (!section) throw new HttpError("NOT_FOUND", "Section not found");

  const subjectOffered = await prisma.classSubject.findFirst({ where: { classId: section.classId, subjectId: input.subjectId }, select: { id: true } });
  if (!subjectOffered) throw new HttpError("SUBJECT_NOT_OFFERED", "This subject is not offered to this section's class");

  const teachingAssignment = await prisma.teachingAssignment.findFirst({ where: { sectionId: input.sectionId, subjectId: input.subjectId, staffId: staff.id }, select: { id: true } });
  if (!teachingAssignment) throw new HttpError("TEACHER_NOT_ASSIGNED", "You are not assigned to teach this subject in this section");

  const topicIds = await validateTopicIds(scope, input.sectionId, input.subjectId, input.topicIds);

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.lessonPlan.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: section.branchId, academicSessionId: requireSession(scope),
        sectionId: input.sectionId, subjectId: input.subjectId, staffId: staff.id, teachingAssignmentId: teachingAssignment.id,
        title: input.title, learningObjective: input.learningObjective, teachingMethod: input.teachingMethod,
        materials: input.materials ?? null, activity: input.activity ?? null, homeworkNote: input.homeworkNote ?? null, assessmentMethod: input.assessmentMethod ?? null,
        plannedDate: new Date(`${input.plannedDate}T00:00:00.000Z`), period: input.period ?? null, status: "DRAFT",
        createdByUserId: scope.actor.id, createdByName: scope.actor.name,
        topics: topicIds.length ? { create: topicIds.map((topicId) => ({ topicId })) } : undefined,
      },
      select: { id: true },
    });
    await recordAudit(tx, scope, "LESSON_PLAN_CREATED", "LessonPlan", row.id, { sectionId: input.sectionId, subjectId: input.subjectId, staffId: staff.id });
    return row;
  });
  return getLessonPlan(scope, created.id);
}

// ── Update (never structural — no section/subject/staff fields exist here) ──

export const updateLessonPlanSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  learningObjective: z.string().trim().min(1).max(2000).optional(),
  teachingMethod: z.string().trim().min(1).max(200).optional(),
  materials: z.string().trim().max(1000).nullable().optional(),
  activity: z.string().trim().max(2000).nullable().optional(),
  homeworkNote: z.string().trim().max(1000).nullable().optional(),
  assessmentMethod: z.string().trim().max(500).nullable().optional(),
  plannedDate: dateStr.optional(),
  period: z.number().int().min(1).max(12).nullable().optional(),
  topicIds: z.array(z.string().min(1)).max(20).optional(),
});

export async function updateLessonPlan(scope: OrgScope, lessonPlanId: string, raw: unknown): Promise<LessonPlanDetailDto> {
  const input = parseInput(updateLessonPlanSchema, raw);
  const existing = await requireLessonPlanInScope(scope, lessonPlanId);
  await assertCanManage(scope, existing.staff.id);
  if (existing.status !== "DRAFT" && existing.status !== "REJECTED") throw new HttpError("CONFLICT", "Only a draft or rejected plan can be edited");

  const topicIds = input.topicIds === undefined ? undefined : await validateTopicIds(scope, existing.section.id, existing.subject.id, input.topicIds);

  await prisma.$transaction(async (tx) => {
    await tx.lessonPlan.update({
      where: { id: lessonPlanId },
      data: {
        title: input.title, learningObjective: input.learningObjective, teachingMethod: input.teachingMethod,
        materials: input.materials === undefined ? undefined : input.materials, activity: input.activity === undefined ? undefined : input.activity,
        homeworkNote: input.homeworkNote === undefined ? undefined : input.homeworkNote, assessmentMethod: input.assessmentMethod === undefined ? undefined : input.assessmentMethod,
        plannedDate: input.plannedDate ? new Date(`${input.plannedDate}T00:00:00.000Z`) : undefined, period: input.period === undefined ? undefined : input.period,
        status: existing.status === "REJECTED" ? "DRAFT" : undefined, reviewComment: existing.status === "REJECTED" ? null : undefined,
      },
    });
    if (topicIds !== undefined) {
      await tx.lessonPlanTopic.deleteMany({ where: { lessonPlanId } });
      if (topicIds.length) await tx.lessonPlanTopic.createMany({ data: topicIds.map((topicId) => ({ lessonPlanId, topicId })) });
    }
    await recordAudit(tx, scope, "LESSON_PLAN_UPDATED", "LessonPlan", lessonPlanId, {});
  });
  return getLessonPlan(scope, lessonPlanId);
}

// ── Lifecycle ────────────────────────────────────────────────────────────

async function transition(
  scope: OrgScope, lessonPlanId: string, from: string[], to: string,
  auditAction: "LESSON_PLAN_STATUS_CHANGED" | "LESSON_PLAN_COMPLETED", extra: Prisma.LessonPlanUpdateInput = {},
  afterTransition?: (tx: Prisma.TransactionClient) => Promise<void>,
) {
  const { count } = await prisma.$transaction(async (tx) => {
    const result = await tx.lessonPlan.updateMany({ where: { id: lessonPlanId, status: { in: from as never[] } }, data: { status: to as never, ...extra } });
    if (result.count > 0) {
      await recordAudit(tx, scope, auditAction, "LessonPlan", lessonPlanId, { to });
      if (afterTransition) await afterTransition(tx);
    }
    return result;
  });
  if (count === 0) throw new HttpError("CONFLICT", `Only a plan in ${from.join("/")} can move to ${to}`);
}

/** Real Staff.userId recipient for LESSON_PLAN_APPROVED/REJECTED — the plan's
 *  own teacher. No-ops (via createNotification's empty-recipients guard) if
 *  the Staff has no linked User account yet. */
async function notifyLessonPlanReview(tx: Prisma.TransactionClient, scope: OrgScope, lessonPlanId: string, type: "LESSON_PLAN_APPROVED" | "LESSON_PLAN_REJECTED", planTitle: string, staffId: string, comment: string | null): Promise<void> {
  const staff = await tx.staff.findUnique({ where: { id: staffId }, select: { userId: true } });
  await createNotification(tx, {
    tenantId: scope.tenantId, schoolId: scope.schoolId, type,
    title: type === "LESSON_PLAN_APPROVED" ? `Lesson plan approved: ${planTitle}` : `Lesson plan rejected: ${planTitle}`,
    body: type === "LESSON_PLAN_APPROVED" ? `Your lesson plan "${planTitle}" was approved.` : `Your lesson plan "${planTitle}" was rejected.${comment ? ` Reason: ${comment}` : ""}`,
    href: "/teacher/lesson-plans", sourceType: "LessonPlan", sourceId: lessonPlanId,
    dedupeKey: `${type}:${lessonPlanId}`, recipientUserIds: staff?.userId ? [staff.userId] : [],
  });
}

export async function submitLessonPlan(scope: OrgScope, lessonPlanId: string): Promise<LessonPlanDetailDto> {
  const existing = await requireLessonPlanInScope(scope, lessonPlanId);
  await assertCanManage(scope, existing.staff.id);
  await transition(scope, lessonPlanId, ["DRAFT"], "SUBMITTED", "LESSON_PLAN_STATUS_CHANGED");
  return getLessonPlan(scope, lessonPlanId);
}

export async function approveLessonPlan(scope: OrgScope, lessonPlanId: string): Promise<LessonPlanDetailDto> {
  if (!(await isBroadLessonPlanManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const existing = await requireLessonPlanInScope(scope, lessonPlanId);
  await transition(scope, lessonPlanId, ["SUBMITTED"], "APPROVED", "LESSON_PLAN_STATUS_CHANGED", { reviewedByUserId: scope.actor.id, reviewedByName: scope.actor.name, reviewComment: null },
    (tx) => notifyLessonPlanReview(tx, scope, lessonPlanId, "LESSON_PLAN_APPROVED", existing.title, existing.staff.id, null));
  return getLessonPlan(scope, lessonPlanId);
}

export const rejectLessonPlanSchema = z.object({ comment: z.string().trim().min(1).max(500) });

export async function rejectLessonPlan(scope: OrgScope, lessonPlanId: string, raw: unknown): Promise<LessonPlanDetailDto> {
  if (!(await isBroadLessonPlanManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(rejectLessonPlanSchema, raw);
  const existing = await requireLessonPlanInScope(scope, lessonPlanId);
  await transition(scope, lessonPlanId, ["SUBMITTED"], "REJECTED", "LESSON_PLAN_STATUS_CHANGED", { reviewedByUserId: scope.actor.id, reviewedByName: scope.actor.name, reviewComment: input.comment },
    (tx) => notifyLessonPlanReview(tx, scope, lessonPlanId, "LESSON_PLAN_REJECTED", existing.title, existing.staff.id, input.comment));
  return getLessonPlan(scope, lessonPlanId);
}

export async function completeLessonPlan(scope: OrgScope, lessonPlanId: string): Promise<LessonPlanDetailDto> {
  const existing = await requireLessonPlanInScope(scope, lessonPlanId);
  await assertCanManage(scope, existing.staff.id);
  await transition(scope, lessonPlanId, ["APPROVED"], "COMPLETED", "LESSON_PLAN_COMPLETED");
  return getLessonPlan(scope, lessonPlanId);
}

// ── Duplicate (preserves original section/subject/staff — never re-derived
// from the duplicating actor; see homework-service.ts's identical fix) ──────

export async function duplicateLessonPlan(scope: OrgScope, lessonPlanId: string, raw: unknown): Promise<LessonPlanDetailDto> {
  const input = parseInput(z.object({ plannedDate: dateStr }), raw);
  const existing = await requireLessonPlanInScope(scope, lessonPlanId);
  await assertCanManage(scope, existing.staff.id);

  const original = await prisma.lessonPlan.findUniqueOrThrow({ where: { id: lessonPlanId }, select: { sectionId: true, subjectId: true, staffId: true, teachingAssignmentId: true, branchId: true } });
  const topicIds = existing.topics.map((t) => t.topic.id);

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.lessonPlan.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: original.branchId, academicSessionId: requireSession(scope),
        sectionId: original.sectionId, subjectId: original.subjectId, staffId: original.staffId, teachingAssignmentId: original.teachingAssignmentId,
        title: `${existing.title} (copy)`, learningObjective: existing.learningObjective, teachingMethod: existing.teachingMethod,
        materials: existing.materials, activity: existing.activity, homeworkNote: existing.homeworkNote, assessmentMethod: existing.assessmentMethod,
        plannedDate: new Date(`${input.plannedDate}T00:00:00.000Z`), period: existing.period, status: "DRAFT",
        createdByUserId: scope.actor.id, createdByName: scope.actor.name,
        topics: topicIds.length ? { create: topicIds.map((topicId) => ({ topicId })) } : undefined,
      },
      select: { id: true },
    });
    await recordAudit(tx, scope, "LESSON_PLAN_CREATED", "LessonPlan", row.id, { duplicatedFrom: lessonPlanId });
    return row;
  });
  return getLessonPlan(scope, created.id);
}

// ── My Day integration (real "Open Lesson Plan") ────────────────────────────

export async function getMyDayLessonPlanSummary(scope: OrgScope, staffId: string, today: string): Promise<{ draftCount: number; items: { id: string; status: LessonPlanStatusDto; section: { id: string; name: string; className: string }; subject: { id: string; name: string; color: string } }[] }> {
  const sessionId = requireSession(scope);
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const [draftCount, rows] = await Promise.all([
    prisma.lessonPlan.count({ where: { schoolId: scope.schoolId, academicSessionId: sessionId, staffId, status: "DRAFT" } }),
    prisma.lessonPlan.findMany({ where: { schoolId: scope.schoolId, academicSessionId: sessionId, staffId, plannedDate: todayDate }, orderBy: [{ period: "asc" }], select: { id: true, status: true, section: { select: { id: true, name: true, class: { select: { name: true } } } }, subject: { select: { id: true, name: true, color: true } } } }),
  ]);
  return {
    draftCount,
    items: rows.map((r) => ({ id: r.id, status: statusToUi(r.status), section: { id: r.section.id, name: r.section.name, className: r.section.class.name }, subject: r.subject })),
  };
}
