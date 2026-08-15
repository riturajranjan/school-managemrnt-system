// Curriculum / Syllabus Tracking (Phase 9C.1) — real, PostgreSQL-backed.
//
// CONTENT vs PROGRESS: Curriculum -> CurriculumUnit -> CurriculumChapter ->
// CurriculumTopic is authored ONCE per (Class, Subject, AcademicSession) — a
// broad-manager-only action (SCHOOL_ADMIN/PRINCIPAL). Units/Chapters carry NO
// persisted status column: their "status" is always computed from real
// CurriculumTopicProgress rows for whichever Section is in view. Progress is
// tracked separately, PER SECTION (different sections of the same class
// progress at different speeds) via CurriculumTopicProgress, upserted by
// either a broad manager or the real TeachingAssignment holder for that
// (section, subject) — mirrors lib/server/homework/service.ts's ownership
// pattern exactly.
//
// LIFECYCLE: DRAFT -> ACTIVE -> ARCHIVED. Progress can only be recorded
// against an ACTIVE curriculum. Units/chapters/topics may only be hard-deleted
// while their curriculum is still DRAFT (no progress can exist yet); once
// ACTIVE, content is edit-only — the whole curriculum archives rather than
// individual content disappearing out from under recorded progress.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ListMeta } from "@/lib/server/api/response";
import type {
  CurriculumAggregateStatusDto, CurriculumChapterDto, CurriculumDetailDto, CurriculumInsightsDto, CurriculumListItemDto,
  CurriculumStatusDto, CurriculumTopicDto, CurriculumUnitDto, SectionCurriculumDto, TopicProgressStatusDto,
} from "@/lib/api/contracts";
import { getCurrentStaffProfile } from "@/lib/server/staff/service";
import { serverToday } from "@/lib/server/attendance/service";

function requireSession(scope: OrgScope): string {
  if (!scope.academicSessionId) throw new HttpError("INVALID_SESSION", "Select an academic session first");
  return scope.academicSessionId;
}

const CURRICULUM_STATUS_TO_DB: Record<CurriculumStatusDto, string> = { draft: "DRAFT", active: "ACTIVE", archived: "ARCHIVED" };
const curriculumStatusToUi = (s: string): CurriculumStatusDto => s.toLowerCase() as CurriculumStatusDto;
const PROGRESS_STATUS_TO_DB: Record<TopicProgressStatusDto, string> = { "not-started": "NOT_STARTED", "in-progress": "IN_PROGRESS", completed: "COMPLETED" };
const progressStatusToUi = (s: string): TopicProgressStatusDto => (s === "NOT_STARTED" ? "not-started" : s === "IN_PROGRESS" ? "in-progress" : "completed");
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
const dateToUi = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const todayDate = () => new Date(`${serverToday()}T00:00:00.000Z`);

// ── Authorization (mirrors homework-service.ts's isBroadHomeworkManager) ────

async function isBroadCurriculumManager(scope: OrgScope): Promise<boolean> {
  const m = await prisma.roleAssignment.findFirst({
    where: { membership: { userId: scope.actor.id, tenantId: scope.tenantId, status: "ACTIVE" }, role: { key: { in: ["SCHOOL_ADMIN", "PRINCIPAL"] } } },
    select: { id: true },
  });
  return Boolean(m);
}

async function assertCanManageContent(scope: OrgScope): Promise<void> {
  if (!(await isBroadCurriculumManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
}

/** Progress-write authorization: a broad manager, or the real TeachingAssignment
 *  holder for (sectionId, subjectId). Mirrors marks/homework ownership exactly. */
async function assertCanRecordProgress(scope: OrgScope, sectionId: string, subjectId: string): Promise<void> {
  if (await isBroadCurriculumManager(scope)) return;
  const staff = await getCurrentStaffProfile(scope);
  if (!staff) throw new HttpError("TEACHER_NOT_ASSIGNED", "You do not have a real teaching Staff profile");
  const assignment = await prisma.teachingAssignment.findFirst({ where: { sectionId, subjectId, staffId: staff.id }, select: { id: true } });
  if (!assignment) throw new HttpError("TEACHER_NOT_ASSIGNED", "You are not assigned to teach this subject in this section");
}

// ── Content selects / DTO mapping ───────────────────────────────────────────

const curriculumSelect = {
  id: true, title: true, description: true, status: true, createdAt: true, updatedAt: true,
  class: { select: { id: true, name: true } },
  subject: { select: { id: true, code: true, name: true, color: true } },
  units: { select: { id: true, chapters: { select: { id: true, topics: { select: { id: true } } } } } },
} satisfies Prisma.CurriculumSelect;
type CurriculumRow = Prisma.CurriculumGetPayload<{ select: typeof curriculumSelect }>;

function curriculumListItemDto(row: CurriculumRow): CurriculumListItemDto {
  const topicCount = row.units.reduce((sum, u) => sum + u.chapters.reduce((s, c) => s + c.topics.length, 0), 0);
  return {
    id: row.id, title: row.title, description: row.description, status: curriculumStatusToUi(row.status),
    class: row.class, subject: row.subject, unitCount: row.units.length, topicCount,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}

const treeSelect = {
  id: true, title: true, description: true, order: true, plannedStart: true, plannedEnd: true, estimatedPeriods: true,
  chapters: {
    orderBy: { order: "asc" as const },
    select: {
      id: true, title: true, order: true,
      topics: { orderBy: { order: "asc" as const }, select: { id: true, title: true, order: true, learningOutcomes: true } },
    },
  },
} satisfies Prisma.CurriculumUnitSelect;
type UnitTreeRow = Prisma.CurriculumUnitGetPayload<{ select: typeof treeSelect }>;

/** Builds the Unit -> Chapter -> Topic DTO tree. `progressByTopic` supplies
 *  per-topic status when the caller is in a Section context; omit for the
 *  content-authoring (no-section) view, where every topic reads not-started
 *  and completedTopics is always 0 — an honest "no section selected" shape,
 *  never a fabricated number. */
function buildUnitTree(units: UnitTreeRow[], progressByTopic: Map<string, { status: string; completedAt: Date | null; staffName: string | null }> | null, today: Date): CurriculumUnitDto[] {
  return units.map((u) => {
    const chapters: CurriculumChapterDto[] = u.chapters.map((c) => {
      const topics: CurriculumTopicDto[] = c.topics.map((t) => {
        const p = progressByTopic?.get(t.id);
        // null = "no section context" (content-authoring view). Inside a
        // section context, every topic gets a real progress object — one
        // with no recorded row yet defaults to not-started, never null.
        return {
          id: t.id, title: t.title, order: t.order, learningOutcomes: t.learningOutcomes,
          progress: !progressByTopic ? null : p ? { status: progressStatusToUi(p.status), completedAt: p.completedAt ? p.completedAt.toISOString() : null, completedByStaffName: p.staffName } : { status: "not-started" as const, completedAt: null, completedByStaffName: null },
        };
      });
      const totalTopics = topics.length;
      const completedTopics = progressByTopic ? topics.filter((t) => t.progress?.status === "completed").length : 0;
      return { id: c.id, title: c.title, order: c.order, status: aggregateStatus(completedTopics, totalTopics, null, today), completedTopics, totalTopics, topics };
    });
    const totalTopics = chapters.reduce((s, c) => s + c.totalTopics, 0);
    const completedTopics = chapters.reduce((s, c) => s + c.completedTopics, 0);
    return {
      id: u.id, title: u.title, description: u.description, order: u.order,
      plannedStart: dateToUi(u.plannedStart), plannedEnd: dateToUi(u.plannedEnd), estimatedPeriods: u.estimatedPeriods,
      status: aggregateStatus(completedTopics, totalTopics, u.plannedEnd, today), completedTopics, totalTopics, chapters,
    };
  });
}

/** Real, date-derived "delayed" — never invented. Completed when every topic
 *  is done; not-started when none are; in-progress otherwise; delayed when a
 *  real plannedEnd has passed without full completion. */
function aggregateStatus(completed: number, total: number, plannedEnd: Date | null, today: Date): CurriculumAggregateStatusDto {
  if (total === 0) return "not-started";
  if (completed >= total) return "completed";
  if (plannedEnd && plannedEnd < today) return "delayed";
  return completed === 0 ? "not-started" : "in-progress";
}

// ── List / detail ────────────────────────────────────────────────────────

export const listCurriculumSchema = z.object({
  classId: z.string().min(1).optional(),
  subjectId: z.string().min(1).optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  search: z.string().trim().min(1).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export async function listCurriculum(scope: OrgScope, raw: unknown): Promise<{ data: CurriculumListItemDto[]; meta: ListMeta }> {
  const input = parseInput(listCurriculumSchema, raw);
  const where: Prisma.CurriculumWhereInput = {
    schoolId: scope.schoolId, academicSessionId: requireSession(scope),
    ...(input.classId ? { classId: input.classId } : {}),
    ...(input.subjectId ? { subjectId: input.subjectId } : {}),
    ...(input.status ? { status: CURRICULUM_STATUS_TO_DB[input.status] as never } : {}),
    ...(input.search ? { title: { contains: input.search, mode: "insensitive" } } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.curriculum.count({ where }),
    prisma.curriculum.findMany({ where, select: curriculumSelect, orderBy: [{ class: { order: "asc" } }, { subject: { name: "asc" } }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
  ]);
  return { data: rows.map(curriculumListItemDto), meta: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.max(1, Math.ceil(total / input.pageSize)) } };
}

async function requireCurriculumInScope(scope: OrgScope, curriculumId: string): Promise<CurriculumRow> {
  const row = await prisma.curriculum.findFirst({ where: { id: curriculumId, schoolId: scope.schoolId, academicSessionId: requireSession(scope) }, select: curriculumSelect });
  if (!row) throw new HttpError("NOT_FOUND", "Curriculum not found");
  return row;
}

export async function getCurriculum(scope: OrgScope, curriculumId: string): Promise<CurriculumDetailDto> {
  const row = await requireCurriculumInScope(scope, curriculumId);
  const units = await prisma.curriculumUnit.findMany({ where: { curriculumId }, orderBy: { order: "asc" }, select: treeSelect });
  return { ...curriculumListItemDto(row), units: buildUnitTree(units, null, todayDate()) };
}

// ── Create / update / status ────────────────────────────────────────────

export const createCurriculumSchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
});

export async function createCurriculum(scope: OrgScope, raw: unknown): Promise<CurriculumDetailDto> {
  await assertCanManageContent(scope);
  const input = parseInput(createCurriculumSchema, raw);
  const sessionId = requireSession(scope);

  const klass = await prisma.class.findFirst({ where: { id: input.classId, schoolId: scope.schoolId, academicSessionId: sessionId }, select: { id: true } });
  if (!klass) throw new HttpError("NOT_FOUND", "Class not found");

  const offered = await prisma.classSubject.findFirst({ where: { classId: input.classId, subjectId: input.subjectId }, select: { id: true } });
  if (!offered) throw new HttpError("SUBJECT_NOT_OFFERED", "This subject is not offered to this class");

  const existing = await prisma.curriculum.findUnique({ where: { schoolId_academicSessionId_classId_subjectId: { schoolId: scope.schoolId, academicSessionId: sessionId, classId: input.classId, subjectId: input.subjectId } }, select: { id: true } });
  if (existing) throw new HttpError("CURRICULUM_ALREADY_EXISTS", "A curriculum already exists for this class and subject");

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.curriculum.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, academicSessionId: sessionId,
        classId: input.classId, subjectId: input.subjectId, title: input.title, description: input.description ?? null,
        status: "DRAFT", createdByUserId: scope.actor.id, createdByName: scope.actor.name,
      },
      select: { id: true },
    });
    await recordAudit(tx, scope, "CURRICULUM_CREATED", "Curriculum", row.id, { classId: input.classId, subjectId: input.subjectId });
    return row;
  });
  return getCurriculum(scope, created.id);
}

export const updateCurriculumSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
});

export async function updateCurriculum(scope: OrgScope, curriculumId: string, raw: unknown): Promise<CurriculumDetailDto> {
  await assertCanManageContent(scope);
  const input = parseInput(updateCurriculumSchema, raw);
  await requireCurriculumInScope(scope, curriculumId);
  await prisma.$transaction(async (tx) => {
    await tx.curriculum.update({ where: { id: curriculumId }, data: { title: input.title, description: input.description === undefined ? undefined : input.description } });
    await recordAudit(tx, scope, "CURRICULUM_UPDATED", "Curriculum", curriculumId, {});
  });
  return getCurriculum(scope, curriculumId);
}

const VALID_TRANSITIONS: Record<string, string[]> = { DRAFT: ["ACTIVE", "ARCHIVED"], ACTIVE: ["ARCHIVED"], ARCHIVED: [] };

export async function changeCurriculumStatus(scope: OrgScope, curriculumId: string, raw: unknown): Promise<CurriculumDetailDto> {
  await assertCanManageContent(scope);
  const input = parseInput(z.object({ status: z.enum(["draft", "active", "archived"]) }), raw);
  const existing = await requireCurriculumInScope(scope, curriculumId);
  const target = CURRICULUM_STATUS_TO_DB[input.status];
  if (!VALID_TRANSITIONS[existing.status].includes(target)) throw new HttpError("INVALID_STATUS_TRANSITION", `Cannot move curriculum from ${existing.status} to ${target}`);

  await prisma.$transaction(async (tx) => {
    await tx.curriculum.update({ where: { id: curriculumId }, data: { status: target as never } });
    await recordAudit(tx, scope, "CURRICULUM_STATUS_CHANGED", "Curriculum", curriculumId, { from: existing.status, to: target });
  });
  return getCurriculum(scope, curriculumId);
}

/** Only a DRAFT curriculum (no progress can exist yet) may be hard-deleted. */
export async function deleteCurriculum(scope: OrgScope, curriculumId: string): Promise<{ id: string }> {
  await assertCanManageContent(scope);
  const existing = await requireCurriculumInScope(scope, curriculumId);
  if (existing.status !== "DRAFT") throw new HttpError("CONFLICT", "Only a draft curriculum can be deleted — archive it instead");
  await prisma.curriculum.delete({ where: { id: curriculumId } });
  return { id: curriculumId };
}

// ── Units / chapters / topics (content authoring — broad managers only) ────

async function requireDraftCurriculumForUnitOp(curriculumId: string): Promise<void> {
  const c = await prisma.curriculum.findUniqueOrThrow({ where: { id: curriculumId }, select: { status: true } });
  if (c.status !== "DRAFT") throw new HttpError("CONFLICT", "Content can only be added or removed while the curriculum is a draft");
}

export const createUnitSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  order: z.number().int().min(0).optional(),
  plannedStart: dateStr.optional(),
  plannedEnd: dateStr.optional(),
  estimatedPeriods: z.number().int().min(0).max(500).optional(),
});

export async function createUnit(scope: OrgScope, curriculumId: string, raw: unknown): Promise<CurriculumDetailDto> {
  await assertCanManageContent(scope);
  const input = parseInput(createUnitSchema, raw);
  await requireCurriculumInScope(scope, curriculumId);
  const nextOrder = input.order ?? (await prisma.curriculumUnit.count({ where: { curriculumId } }));
  await prisma.$transaction(async (tx) => {
    const unit = await tx.curriculumUnit.create({
      data: {
        curriculumId, title: input.title, description: input.description ?? null, order: nextOrder,
        plannedStart: input.plannedStart ? new Date(`${input.plannedStart}T00:00:00.000Z`) : null,
        plannedEnd: input.plannedEnd ? new Date(`${input.plannedEnd}T00:00:00.000Z`) : null,
        estimatedPeriods: input.estimatedPeriods ?? 0,
      },
      select: { id: true },
    });
    await recordAudit(tx, scope, "CURRICULUM_UNIT_CREATED", "CurriculumUnit", unit.id, { curriculumId });
  });
  return getCurriculum(scope, curriculumId);
}

export const updateUnitSchema = createUnitSchema.partial();

async function requireUnitInScope(scope: OrgScope, unitId: string) {
  const unit = await prisma.curriculumUnit.findUnique({ where: { id: unitId }, select: { id: true, curriculumId: true, curriculum: { select: { schoolId: true, academicSessionId: true } } } });
  if (!unit || unit.curriculum.schoolId !== scope.schoolId || unit.curriculum.academicSessionId !== scope.academicSessionId) throw new HttpError("NOT_FOUND", "Unit not found");
  return unit;
}

export async function updateUnit(scope: OrgScope, unitId: string, raw: unknown): Promise<CurriculumDetailDto> {
  await assertCanManageContent(scope);
  const input = parseInput(updateUnitSchema, raw);
  const unit = await requireUnitInScope(scope, unitId);
  await prisma.$transaction(async (tx) => {
    await tx.curriculumUnit.update({
      where: { id: unitId },
      data: {
        title: input.title, description: input.description, order: input.order, estimatedPeriods: input.estimatedPeriods,
        plannedStart: input.plannedStart === undefined ? undefined : new Date(`${input.plannedStart}T00:00:00.000Z`),
        plannedEnd: input.plannedEnd === undefined ? undefined : new Date(`${input.plannedEnd}T00:00:00.000Z`),
      },
    });
    await recordAudit(tx, scope, "CURRICULUM_UNIT_UPDATED", "CurriculumUnit", unitId, {});
  });
  return getCurriculum(scope, unit.curriculumId);
}

export async function deleteUnit(scope: OrgScope, unitId: string): Promise<{ id: string }> {
  await assertCanManageContent(scope);
  const unit = await requireUnitInScope(scope, unitId);
  await requireDraftCurriculumForUnitOp(unit.curriculumId);
  await prisma.curriculumUnit.delete({ where: { id: unitId } });
  return { id: unitId };
}

export const createChapterSchema = z.object({ title: z.string().trim().min(1).max(160), order: z.number().int().min(0).optional() });

async function requireUnitScope(scope: OrgScope, unitId: string) {
  return requireUnitInScope(scope, unitId);
}

export async function createChapter(scope: OrgScope, unitId: string, raw: unknown): Promise<CurriculumDetailDto> {
  await assertCanManageContent(scope);
  const input = parseInput(createChapterSchema, raw);
  const unit = await requireUnitScope(scope, unitId);
  const nextOrder = input.order ?? (await prisma.curriculumChapter.count({ where: { unitId } }));
  await prisma.$transaction(async (tx) => {
    const chapter = await tx.curriculumChapter.create({ data: { unitId, title: input.title, order: nextOrder }, select: { id: true } });
    await recordAudit(tx, scope, "CURRICULUM_CHAPTER_CREATED", "CurriculumChapter", chapter.id, { unitId });
  });
  return getCurriculum(scope, unit.curriculumId);
}

export const updateChapterSchema = createChapterSchema.partial();

async function requireChapterInScope(scope: OrgScope, chapterId: string) {
  const chapter = await prisma.curriculumChapter.findUnique({ where: { id: chapterId }, select: { id: true, unitId: true, unit: { select: { curriculumId: true, curriculum: { select: { schoolId: true, academicSessionId: true } } } } } });
  if (!chapter || chapter.unit.curriculum.schoolId !== scope.schoolId || chapter.unit.curriculum.academicSessionId !== scope.academicSessionId) throw new HttpError("NOT_FOUND", "Chapter not found");
  return chapter;
}

export async function updateChapter(scope: OrgScope, chapterId: string, raw: unknown): Promise<CurriculumDetailDto> {
  await assertCanManageContent(scope);
  const input = parseInput(updateChapterSchema, raw);
  const chapter = await requireChapterInScope(scope, chapterId);
  await prisma.$transaction(async (tx) => {
    await tx.curriculumChapter.update({ where: { id: chapterId }, data: { title: input.title, order: input.order } });
    await recordAudit(tx, scope, "CURRICULUM_CHAPTER_UPDATED", "CurriculumChapter", chapterId, {});
  });
  return getCurriculum(scope, chapter.unit.curriculumId);
}

export async function deleteChapter(scope: OrgScope, chapterId: string): Promise<{ id: string }> {
  await assertCanManageContent(scope);
  const chapter = await requireChapterInScope(scope, chapterId);
  await requireDraftCurriculumForUnitOp(chapter.unit.curriculumId);
  await prisma.curriculumChapter.delete({ where: { id: chapterId } });
  return { id: chapterId };
}

export const createTopicSchema = z.object({ title: z.string().trim().min(1).max(200), order: z.number().int().min(0).optional(), learningOutcomes: z.array(z.string().trim().min(1).max(300)).max(20).optional() });

export async function createTopic(scope: OrgScope, chapterId: string, raw: unknown): Promise<CurriculumDetailDto> {
  await assertCanManageContent(scope);
  const input = parseInput(createTopicSchema, raw);
  const chapter = await requireChapterInScope(scope, chapterId);
  const nextOrder = input.order ?? (await prisma.curriculumTopic.count({ where: { chapterId } }));
  await prisma.$transaction(async (tx) => {
    const topic = await tx.curriculumTopic.create({ data: { chapterId, title: input.title, order: nextOrder, learningOutcomes: input.learningOutcomes ?? [] }, select: { id: true } });
    await recordAudit(tx, scope, "CURRICULUM_TOPIC_CREATED", "CurriculumTopic", topic.id, { chapterId });
  });
  return getCurriculum(scope, chapter.unit.curriculumId);
}

export const updateTopicSchema = createTopicSchema.partial();

async function requireTopicInScope(scope: OrgScope, topicId: string) {
  const topic = await prisma.curriculumTopic.findUnique({ where: { id: topicId }, select: { id: true, chapterId: true, chapter: { select: { unitId: true, unit: { select: { curriculumId: true, curriculum: { select: { schoolId: true, academicSessionId: true, subjectId: true } } } } } } } });
  if (!topic || topic.chapter.unit.curriculum.schoolId !== scope.schoolId || topic.chapter.unit.curriculum.academicSessionId !== scope.academicSessionId) throw new HttpError("NOT_FOUND", "Topic not found");
  return topic;
}

export async function updateTopic(scope: OrgScope, topicId: string, raw: unknown): Promise<CurriculumDetailDto> {
  await assertCanManageContent(scope);
  const input = parseInput(updateTopicSchema, raw);
  const topic = await requireTopicInScope(scope, topicId);
  await prisma.$transaction(async (tx) => {
    await tx.curriculumTopic.update({ where: { id: topicId }, data: { title: input.title, order: input.order, learningOutcomes: input.learningOutcomes } });
    await recordAudit(tx, scope, "CURRICULUM_TOPIC_UPDATED", "CurriculumTopic", topicId, {});
  });
  return getCurriculum(scope, topic.chapter.unit.curriculumId);
}

export async function deleteTopic(scope: OrgScope, topicId: string): Promise<{ id: string }> {
  await assertCanManageContent(scope);
  const topic = await requireTopicInScope(scope, topicId);
  await requireDraftCurriculumForUnitOp(topic.chapter.unit.curriculumId);
  try {
    await prisma.curriculumTopic.delete({ where: { id: topicId } });
  } catch {
    throw new HttpError("CONFLICT", "This topic is referenced by a lesson plan and cannot be deleted");
  }
  return { id: topicId };
}

// ── Assignable curricula (for the Lesson Plan create form's topic picker,
// and this teacher's own real TeachingAssignment sections) ─────────────────

export async function listAssignableCurriculumTopics(scope: OrgScope, sectionId: string, subjectId: string): Promise<{ id: string; title: string; chapterTitle: string; unitTitle: string }[]> {
  const section = await prisma.section.findFirst({ where: { id: sectionId, schoolId: scope.schoolId, academicSessionId: requireSession(scope) }, select: { classId: true } });
  if (!section) return [];
  const curriculum = await prisma.curriculum.findUnique({ where: { schoolId_academicSessionId_classId_subjectId: { schoolId: scope.schoolId, academicSessionId: requireSession(scope), classId: section.classId, subjectId } }, select: { id: true, status: true } });
  if (!curriculum || curriculum.status !== "ACTIVE") return [];
  const units = await prisma.curriculumUnit.findMany({ where: { curriculumId: curriculum.id }, orderBy: { order: "asc" }, select: { title: true, chapters: { orderBy: { order: "asc" }, select: { title: true, topics: { orderBy: { order: "asc" }, select: { id: true, title: true } } } } } });
  return units.flatMap((u) => u.chapters.flatMap((c) => c.topics.map((t) => ({ id: t.id, title: t.title, chapterTitle: c.title, unitTitle: u.title }))));
}

// ── Section-scoped curriculum + progress ────────────────────────────────

export async function getSectionCurriculum(scope: OrgScope, sectionId: string, subjectId: string): Promise<SectionCurriculumDto | null> {
  const sessionId = requireSession(scope);
  const section = await prisma.section.findFirst({ where: { id: sectionId, schoolId: scope.schoolId, academicSessionId: sessionId }, select: { id: true, classId: true } });
  if (!section) throw new HttpError("NOT_FOUND", "Section not found");

  const curriculum = await prisma.curriculum.findUnique({
    where: { schoolId_academicSessionId_classId_subjectId: { schoolId: scope.schoolId, academicSessionId: sessionId, classId: section.classId, subjectId } },
    select: curriculumSelect,
  });
  if (!curriculum) return null;

  const units = await prisma.curriculumUnit.findMany({ where: { curriculumId: curriculum.id }, orderBy: { order: "asc" }, select: treeSelect });
  const topicIds = units.flatMap((u) => u.chapters.flatMap((c) => c.topics.map((t) => t.id)));
  const progressRows = topicIds.length
    ? await prisma.curriculumTopicProgress.findMany({ where: { sectionId, topicId: { in: topicIds } }, select: { topicId: true, status: true, completedAt: true, completedByStaff: { select: { firstName: true, lastName: true, displayName: true } } } })
    : [];
  const progressByTopic = new Map(progressRows.map((p) => [p.topicId, { status: p.status, completedAt: p.completedAt, staffName: p.completedByStaff ? (p.completedByStaff.displayName?.trim() || `${p.completedByStaff.firstName} ${p.completedByStaff.lastName ?? ""}`.trim()) : null }]));

  const unitDtos = buildUnitTree(units, progressByTopic, todayDate());
  const totalTopics = unitDtos.reduce((s, u) => s + u.totalTopics, 0);
  const completedTopics = unitDtos.reduce((s, u) => s + u.completedTopics, 0);
  return { curriculum: curriculumListItemDto(curriculum), units: unitDtos, overallPercent: totalTopics === 0 ? null : Math.round((completedTopics / totalTopics) * 100) };
}

export const updateTopicProgressSchema = z.object({ status: z.enum(["not-started", "in-progress", "completed"]) });

export async function updateTopicProgress(scope: OrgScope, sectionId: string, topicId: string, raw: unknown): Promise<SectionCurriculumDto> {
  const input = parseInput(updateTopicProgressSchema, raw);
  const topic = await requireTopicInScope(scope, topicId);
  const curriculum = await prisma.curriculum.findUniqueOrThrow({ where: { id: topic.chapter.unit.curriculumId }, select: { subjectId: true, classId: true, status: true } });
  if (curriculum.status !== "ACTIVE") throw new HttpError("CONFLICT", "Progress can only be recorded against an active curriculum");

  const section = await prisma.section.findFirst({ where: { id: sectionId, schoolId: scope.schoolId, academicSessionId: requireSession(scope), classId: curriculum.classId }, select: { id: true, branchId: true } });
  if (!section) throw new HttpError("NOT_FOUND", "Section not found for this curriculum's class");

  await assertCanRecordProgress(scope, sectionId, curriculum.subjectId);
  const staff = await getCurrentStaffProfile(scope);
  const dbStatus = PROGRESS_STATUS_TO_DB[input.status];

  await prisma.$transaction(async (tx) => {
    await tx.curriculumTopicProgress.upsert({
      where: { sectionId_topicId: { sectionId, topicId } },
      create: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: section.branchId, academicSessionId: requireSession(scope),
        sectionId, topicId, status: dbStatus as never,
        completedAt: dbStatus === "COMPLETED" ? new Date() : null, completedByStaffId: dbStatus === "COMPLETED" ? (staff?.id ?? null) : null,
      },
      update: { status: dbStatus as never, completedAt: dbStatus === "COMPLETED" ? new Date() : null, completedByStaffId: dbStatus === "COMPLETED" ? (staff?.id ?? null) : null },
    });
    await recordAudit(tx, scope, "CURRICULUM_TOPIC_PROGRESS_UPDATED", "CurriculumTopicProgress", topicId, { sectionId, status: dbStatus });
  });
  return (await getSectionCurriculum(scope, sectionId, curriculum.subjectId))!;
}

/** Preserves the existing UI's unit-level "Mark complete" button — marks every
 *  topic under the unit COMPLETED for this section, in one transaction. */
export async function completeUnitForSection(scope: OrgScope, sectionId: string, unitId: string): Promise<SectionCurriculumDto> {
  const unit = await requireUnitInScope(scope, unitId);
  const curriculum = await prisma.curriculum.findUniqueOrThrow({ where: { id: unit.curriculumId }, select: { subjectId: true, classId: true, status: true } });
  if (curriculum.status !== "ACTIVE") throw new HttpError("CONFLICT", "Progress can only be recorded against an active curriculum");

  const section = await prisma.section.findFirst({ where: { id: sectionId, schoolId: scope.schoolId, academicSessionId: requireSession(scope), classId: curriculum.classId }, select: { id: true, branchId: true } });
  if (!section) throw new HttpError("NOT_FOUND", "Section not found for this curriculum's class");

  await assertCanRecordProgress(scope, sectionId, curriculum.subjectId);
  const staff = await getCurrentStaffProfile(scope);
  const topics = await prisma.curriculumTopic.findMany({ where: { chapter: { unitId } }, select: { id: true } });

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    for (const topic of topics) {
      await tx.curriculumTopicProgress.upsert({
        where: { sectionId_topicId: { sectionId, topicId: topic.id } },
        create: { tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: section.branchId, academicSessionId: requireSession(scope), sectionId, topicId: topic.id, status: "COMPLETED", completedAt: now, completedByStaffId: staff?.id ?? null },
        update: { status: "COMPLETED", completedAt: now, completedByStaffId: staff?.id ?? null },
      });
    }
    await recordAudit(tx, scope, "CURRICULUM_TOPIC_PROGRESS_UPDATED", "CurriculumUnit", unitId, { sectionId, bulkComplete: true, topicCount: topics.length });
  });
  return (await getSectionCurriculum(scope, sectionId, curriculum.subjectId))!;
}

// ── Insights (real, DB-derived rollups for the Curriculum page's stat tiles
// and "completion by class/subject/teacher" panels) ─────────────────────────

export async function getCurriculumInsights(scope: OrgScope): Promise<CurriculumInsightsDto> {
  const sessionId = requireSession(scope);
  const today = todayDate();

  const curricula = await prisma.curriculum.findMany({
    where: { schoolId: scope.schoolId, academicSessionId: sessionId, status: "ACTIVE" },
    select: { id: true, classId: true, subjectId: true, class: { select: { name: true } }, subject: { select: { name: true, color: true } } },
  });
  if (curricula.length === 0) return { overallPercent: null, unitsTracked: 0, delayedUnits: 0, classesTracked: 0, byClass: [], bySubject: [], byTeacher: [] };

  const curriculumIds = curricula.map((c) => c.id);
  const units = await prisma.curriculumUnit.findMany({
    where: { curriculumId: { in: curriculumIds } },
    select: { id: true, curriculumId: true, plannedEnd: true, chapters: { select: { topics: { select: { id: true } } } } },
  });
  const topicToCurriculum = new Map<string, string>();
  for (const u of units) for (const c of u.chapters) for (const t of c.topics) topicToCurriculum.set(t.id, u.curriculumId);
  const allTopicIds = [...topicToCurriculum.keys()];

  const classIds = [...new Set(curricula.map((c) => c.classId))];
  const sections = await prisma.section.findMany({ where: { classId: { in: classIds }, status: "ACTIVE" }, select: { id: true, classId: true } });
  const sectionIds = sections.map((s) => s.id);

  const progressRows = allTopicIds.length && sectionIds.length
    ? await prisma.curriculumTopicProgress.findMany({ where: { topicId: { in: allTopicIds }, sectionId: { in: sectionIds }, status: "COMPLETED" }, select: { topicId: true, sectionId: true } })
    : [];
  // completedTopicSections has one entry per (sectionId, topicId) completed pair.
  const completedTopicSections = new Set(progressRows.map((p) => `${p.sectionId}:${p.topicId}`));
  // completedByKey[`${curriculumId}:${sectionId}`] = count of completed topics
  const completedByKey = new Map<string, number>();
  for (const p of progressRows) {
    const curriculumId = topicToCurriculum.get(p.topicId);
    if (!curriculumId) continue;
    const key = `${curriculumId}:${p.sectionId}`;
    completedByKey.set(key, (completedByKey.get(key) ?? 0) + 1);
  }

  const totalTopicsByCurriculum = new Map<string, number>();
  for (const [, curriculumId] of topicToCurriculum) totalTopicsByCurriculum.set(curriculumId, (totalTopicsByCurriculum.get(curriculumId) ?? 0) + 1);

  const sectionsByClass = new Map<string, string[]>();
  for (const s of sections) sectionsByClass.set(s.classId, [...(sectionsByClass.get(s.classId) ?? []), s.id]);

  // Real teacher attribution: TeachingAssignment(sectionId, subjectId) -> staff.
  const assignments = await prisma.teachingAssignment.findMany({
    where: { sectionId: { in: sectionIds }, subjectId: { in: curricula.map((c) => c.subjectId) } },
    select: { sectionId: true, subjectId: true, staffId: true, staff: { select: { firstName: true, lastName: true, displayName: true } } },
  });
  const teacherNameById = new Map(assignments.map((a) => [a.staffId, a.staff.displayName?.trim() || `${a.staff.firstName} ${a.staff.lastName ?? ""}`.trim()]));

  /** Percent for one (curriculumId, sectionId) pair — null if the curriculum has no topics. */
  function pctFor(curriculumId: string, sectionId: string): number | null {
    const total = totalTopicsByCurriculum.get(curriculumId) ?? 0;
    if (total === 0) return null;
    const completed = completedByKey.get(`${curriculumId}:${sectionId}`) ?? 0;
    return Math.round((completed / total) * 100);
  }
  function average(values: number[]): number | null {
    return values.length === 0 ? null : Math.round(values.reduce((s, v) => s + v, 0) / values.length);
  }

  const allPairPercents: number[] = [];
  const byClassMap = new Map<string, number[]>();
  const bySubjectMap = new Map<string, number[]>();
  const byTeacherMap = new Map<string, number[]>();

  for (const curriculum of curricula) {
    const classSections = sectionsByClass.get(curriculum.classId) ?? [];
    for (const sectionId of classSections) {
      const pct = pctFor(curriculum.id, sectionId);
      if (pct === null) continue;
      allPairPercents.push(pct);
      byClassMap.set(curriculum.classId, [...(byClassMap.get(curriculum.classId) ?? []), pct]);
      bySubjectMap.set(curriculum.subjectId, [...(bySubjectMap.get(curriculum.subjectId) ?? []), pct]);
      const teacherAssignment = assignments.find((a) => a.sectionId === sectionId && a.subjectId === curriculum.subjectId);
      if (teacherAssignment) byTeacherMap.set(teacherAssignment.staffId, [...(byTeacherMap.get(teacherAssignment.staffId) ?? []), pct]);
    }
  }

  const delayedUnits = units.filter((u) => {
    if (!u.plannedEnd || u.plannedEnd >= today) return false;
    const curriculum = curricula.find((c) => c.id === u.curriculumId)!;
    const classSections = sectionsByClass.get(curriculum.classId) ?? [];
    const unitTopicIds = u.chapters.flatMap((c) => c.topics.map((t) => t.id));
    if (unitTopicIds.length === 0) return false;
    // Delayed if AT LEAST ONE of this class's sections hasn't finished every
    // topic in the unit by its real planned end date.
    return classSections.some((sectionId) => unitTopicIds.some((topicId) => !completedTopicSections.has(`${sectionId}:${topicId}`)));
  });

  const classNameById = new Map(curricula.map((c) => [c.classId, c.class.name]));
  const subjectNameById = new Map(curricula.map((c) => [c.subjectId, c.subject.name]));
  const subjectColorById = new Map(curricula.map((c) => [c.subjectId, c.subject.color]));

  return {
    overallPercent: average(allPairPercents),
    unitsTracked: units.length,
    delayedUnits: delayedUnits.length,
    classesTracked: classIds.length,
    byClass: [...byClassMap.entries()].map(([classId, pcts]) => ({ classId, className: classNameById.get(classId) ?? "", percent: average(pcts) })),
    bySubject: [...bySubjectMap.entries()].map(([subjectId, pcts]) => ({ subjectId, subjectName: subjectNameById.get(subjectId) ?? "", subjectColor: subjectColorById.get(subjectId) ?? "#18b0c8", percent: average(pcts) })),
    byTeacher: [...byTeacherMap.entries()].map(([staffId, pcts]) => ({ staffId, staffName: teacherNameById.get(staffId) ?? "", percent: average(pcts) })),
  };
}
