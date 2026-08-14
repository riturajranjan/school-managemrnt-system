// Exams foundation (Phase 8A) — real, PostgreSQL-backed ExamTerm / Exam / ExamClass.
// Marks entry, results, grading and report cards are DELIBERATELY not modelled
// here (Phase 8B+). Every query/mutation is constrained to the caller's validated
// OrgScope; a foreign id simply matches nothing. Routes enforce exams.view (read)
// / exams.manage (write). No feature gate — Exams is not plan-controlled (no
// "exams" key exists in the feature catalogue, mirroring Academics/Timetable).
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ExamDetailDto, ExamListItemDto, ExamMode, ExamScope as ExamScopeUi, ExamStatus, ExamTermDto, ExamTermStatus, ExamType } from "@/lib/api/contracts";
// Reuse the ONE centralized date-only convention (YYYY-MM-DD ↔ UTC-midnight Date) —
// not attendance-specific logic, just the shared date helper.
import { dateToUi, parseAttendanceDate as parseExamDate } from "@/lib/server/attendance/service";

function requireSession(scope: OrgScope): string {
  if (!scope.academicSessionId) throw new HttpError("INVALID_SESSION", "Select an academic session first");
  return scope.academicSessionId;
}

// ── Term schemas ─────────────────────────────────────────────────────────────

export const createTermSchema = z.object({
  name: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(20),
  order: z.number().int().min(0).max(1000).optional(),
});
export const updateTermSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  code: z.string().trim().min(1).max(20).optional(),
  order: z.number().int().min(0).max(1000).optional(),
});
const TERM_STATUS_TO_DB: Record<ExamTermStatus, string> = { active: "ACTIVE", archived: "ARCHIVED" };

function termDto(t: { id: string; name: string; code: string; order: number; status: string; _count?: { exams: number } }): ExamTermDto {
  return { id: t.id, name: t.name, code: t.code, order: t.order, status: t.status.toLowerCase() as ExamTermStatus, examCount: t._count?.exams ?? 0 };
}
const termSelect = { id: true, name: true, code: true, order: true, status: true, _count: { select: { exams: true } } } satisfies Prisma.ExamTermSelect;

export async function listTerms(scope: OrgScope): Promise<ExamTermDto[]> {
  const rows = await prisma.examTerm.findMany({
    where: { schoolId: scope.schoolId, academicSessionId: requireSession(scope) },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: termSelect,
  });
  return rows.map(termDto);
}

async function requireTermInScope(scope: OrgScope, termId: string): Promise<{ id: string }> {
  const t = await prisma.examTerm.findFirst({ where: { id: termId, schoolId: scope.schoolId, academicSessionId: requireSession(scope) }, select: { id: true } });
  if (!t) throw new HttpError("EXAM_TERM_NOT_FOUND", "Exam term not found");
  return t;
}

async function assertTermCodeFree(scope: OrgScope, code: string, exceptId?: string): Promise<void> {
  const clash = await prisma.examTerm.findFirst({
    where: { schoolId: scope.schoolId, academicSessionId: requireSession(scope), code: { equals: code, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (clash) throw new HttpError("CONFLICT", "A term with this code already exists in this academic session");
}

export async function createTerm(scope: OrgScope, raw: unknown): Promise<ExamTermDto> {
  const input = parseInput(createTermSchema, raw);
  await assertTermCodeFree(scope, input.code);
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.examTerm.create({
      data: { tenantId: scope.tenantId, schoolId: scope.schoolId, academicSessionId: requireSession(scope), name: input.name, code: input.code, order: input.order ?? 0 },
      select: termSelect,
    });
    await recordAudit(tx, scope, "EXAM_TERM_CREATED", "ExamTerm", row.id, { code: row.code, name: row.name });
    return row;
  });
  return termDto(created);
}

export async function updateTerm(scope: OrgScope, termId: string, raw: unknown): Promise<ExamTermDto> {
  const input = parseInput(updateTermSchema, raw);
  await requireTermInScope(scope, termId);
  if (input.code) await assertTermCodeFree(scope, input.code, termId);
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.examTerm.update({ where: { id: termId }, data: { name: input.name, code: input.code, order: input.order }, select: termSelect });
    await recordAudit(tx, scope, "EXAM_TERM_UPDATED", "ExamTerm", termId);
    return row;
  });
  return termDto(updated);
}

export async function setTermStatus(scope: OrgScope, termId: string, status: ExamTermStatus): Promise<ExamTermDto> {
  await requireTermInScope(scope, termId);
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.examTerm.update({ where: { id: termId }, data: { status: TERM_STATUS_TO_DB[status] as never }, select: termSelect });
    await recordAudit(tx, scope, "EXAM_TERM_STATUS_CHANGED", "ExamTerm", termId, { status });
    return row;
  });
  return termDto(updated);
}

// ── Exam schemas ─────────────────────────────────────────────────────────────

const examTypeEnum = z.enum(["unit-test", "weekly-test", "monthly-test", "midterm", "half-yearly", "annual", "pre-board", "board", "practical", "oral", "assignment", "project", "internal-assessment", "custom"]);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

export const createExamSchema = z.object({
  examTermId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(20),
  type: examTypeEnum.default("custom"),
  description: z.string().trim().max(500).optional(),
  startsOn: dateStr,
  endsOn: dateStr,
  scope: z.enum(["internal", "external"]).default("internal"),
  mode: z.enum(["online", "offline"]).default("offline"),
}).refine((d) => d.endsOn >= d.startsOn, { message: "End date must be on or after the start date", path: ["endsOn"] });

export const updateExamSchema = z.object({
  examTermId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  code: z.string().trim().min(1).max(20).optional(),
  type: examTypeEnum.optional(),
  description: z.string().trim().max(500).nullable().optional(),
  startsOn: dateStr.optional(),
  endsOn: dateStr.optional(),
  scope: z.enum(["internal", "external"]).optional(),
  mode: z.enum(["online", "offline"]).optional(),
});

const TYPE_TO_DB: Record<ExamType, string> = {
  "unit-test": "UNIT_TEST", "weekly-test": "WEEKLY_TEST", "monthly-test": "MONTHLY_TEST", midterm: "MIDTERM", "half-yearly": "HALF_YEARLY",
  annual: "ANNUAL", "pre-board": "PRE_BOARD", board: "BOARD", practical: "PRACTICAL", oral: "ORAL", assignment: "ASSIGNMENT",
  project: "PROJECT", "internal-assessment": "INTERNAL_ASSESSMENT", custom: "CUSTOM",
};
const typeToUi = (t: string): ExamType => t.toLowerCase().replace(/_/g, "-") as ExamType;
const EXAM_STATUS_TO_DB: Record<ExamStatus, string> = { draft: "DRAFT", scheduled: "SCHEDULED", completed: "COMPLETED", archived: "ARCHIVED" };
const SCOPE_TO_DB: Record<ExamScopeUi, string> = { internal: "INTERNAL", external: "EXTERNAL" };
const MODE_TO_DB: Record<ExamMode, string> = { online: "ONLINE", offline: "OFFLINE" };

type ExamRow = {
  id: string; name: string; code: string; type: string; description: string | null; startsOn: Date; endsOn: Date;
  scope: string; mode: string; status: string; term: { id: string; name: string };
  _count?: { classes: number; schedule: number };
};
function listDto(e: ExamRow): ExamListItemDto {
  return {
    id: e.id, name: e.name, code: e.code, type: typeToUi(e.type), term: e.term,
    startsOn: dateToUi(e.startsOn), endsOn: dateToUi(e.endsOn),
    scope: e.scope.toLowerCase() as ExamScopeUi, mode: e.mode.toLowerCase() as ExamMode, status: e.status.toLowerCase() as ExamStatus,
    classCount: e._count?.classes ?? 0, scheduleCount: e._count?.schedule ?? 0,
  };
}
const examListSelect = {
  id: true, name: true, code: true, type: true, description: true, startsOn: true, endsOn: true, scope: true, mode: true, status: true,
  term: { select: { id: true, name: true } }, _count: { select: { classes: true, schedule: true } },
} satisfies Prisma.ExamSelect;

export type ListExamParams = { status?: string; termId?: string; search?: string };

export async function listExams(scope: OrgScope, params: ListExamParams = {}): Promise<ExamListItemDto[]> {
  const where: Prisma.ExamWhereInput = { schoolId: scope.schoolId, academicSessionId: requireSession(scope) };
  if (params.status && params.status in EXAM_STATUS_TO_DB) where.status = EXAM_STATUS_TO_DB[params.status as ExamStatus] as never;
  if (params.termId) where.examTermId = params.termId;
  if (params.search?.trim()) {
    const q = params.search.trim();
    where.OR = [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }];
  }
  const rows = await prisma.exam.findMany({ where, orderBy: [{ startsOn: "desc" }], select: examListSelect });
  return rows.map(listDto);
}

async function requireExamInScope(scope: OrgScope, examId: string): Promise<{ id: string }> {
  const e = await prisma.exam.findFirst({ where: { id: examId, schoolId: scope.schoolId, academicSessionId: requireSession(scope) }, select: { id: true } });
  if (!e) throw new HttpError("EXAM_NOT_FOUND", "Exam not found");
  return e;
}
async function assertExamCodeFree(scope: OrgScope, code: string, exceptId?: string): Promise<void> {
  const clash = await prisma.exam.findFirst({
    where: { schoolId: scope.schoolId, academicSessionId: requireSession(scope), code: { equals: code, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (clash) throw new HttpError("CONFLICT", "An exam with this code already exists in this academic session");
}

export async function getExam(scope: OrgScope, examId: string): Promise<ExamDetailDto> {
  await requireExamInScope(scope, examId);
  const e = await prisma.exam.findUniqueOrThrow({
    where: { id: examId },
    select: { ...examListSelect, classes: { select: { class: { select: { id: true, name: true } } } } },
  });
  return { ...listDto(e), description: e.description, classes: e.classes.map((c) => c.class) };
}

export async function createExam(scope: OrgScope, raw: unknown): Promise<ExamDetailDto> {
  const input = parseInput(createExamSchema, raw);
  await requireTermInScope(scope, input.examTermId);
  await assertExamCodeFree(scope, input.code);
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.exam.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, academicSessionId: requireSession(scope), examTermId: input.examTermId,
        name: input.name, code: input.code, type: TYPE_TO_DB[input.type] as never, description: input.description,
        startsOn: parseExamDate(input.startsOn), endsOn: parseExamDate(input.endsOn),
        scope: SCOPE_TO_DB[input.scope] as never, mode: MODE_TO_DB[input.mode] as never,
      },
      select: { id: true },
    });
    await recordAudit(tx, scope, "EXAM_CREATED", "Exam", row.id, { code: input.code, name: input.name, examTermId: input.examTermId });
    return row;
  });
  return getExam(scope, created.id);
}

export async function updateExam(scope: OrgScope, examId: string, raw: unknown): Promise<ExamDetailDto> {
  const input = parseInput(updateExamSchema, raw);
  await requireExamInScope(scope, examId);
  if (input.examTermId) await requireTermInScope(scope, input.examTermId);
  if (input.code) await assertExamCodeFree(scope, input.code, examId);
  if (input.startsOn && input.endsOn && input.endsOn < input.startsOn) throw new HttpError("VALIDATION_ERROR", "End date must be on or after the start date");
  await prisma.$transaction(async (tx) => {
    await tx.exam.update({
      where: { id: examId },
      data: {
        examTermId: input.examTermId, name: input.name, code: input.code, type: input.type ? (TYPE_TO_DB[input.type] as never) : undefined,
        description: input.description, startsOn: input.startsOn ? parseExamDate(input.startsOn) : undefined, endsOn: input.endsOn ? parseExamDate(input.endsOn) : undefined,
        scope: input.scope ? (SCOPE_TO_DB[input.scope] as never) : undefined, mode: input.mode ? (MODE_TO_DB[input.mode] as never) : undefined,
      },
    });
    await recordAudit(tx, scope, "EXAM_UPDATED", "Exam", examId);
  });
  return getExam(scope, examId);
}

export async function setExamStatus(scope: OrgScope, examId: string, status: ExamStatus): Promise<ExamDetailDto> {
  await requireExamInScope(scope, examId);
  await prisma.$transaction(async (tx) => {
    await tx.exam.update({ where: { id: examId }, data: { status: EXAM_STATUS_TO_DB[status] as never } });
    await recordAudit(tx, scope, "EXAM_STATUS_CHANGED", "Exam", examId, { status });
  });
  return getExam(scope, examId);
}

// ── Class applicability (atomic reconcile, matching the ClassSubject precedent) ──

export const reconcileClassesSchema = z.object({ classIds: z.array(z.string().min(1)).max(200) });

export async function reconcileExamClasses(scope: OrgScope, examId: string, raw: unknown): Promise<{ id: string; name: string }[]> {
  const { classIds } = parseInput(reconcileClassesSchema, raw);
  await requireExamInScope(scope, examId);
  const desired = [...new Set(classIds)];
  if (desired.length) {
    const found = await prisma.class.findMany({ where: { id: { in: desired }, schoolId: scope.schoolId, academicSessionId: requireSession(scope) }, select: { id: true } });
    if (found.length !== desired.length) throw new HttpError("VALIDATION_ERROR", "One or more classes are not valid or not in this academic session");
  }
  const existing = await prisma.examClass.findMany({ where: { examId }, select: { id: true, classId: true } });
  const existingIds = new Set(existing.map((e) => e.classId));
  const toAdd = desired.filter((id) => !existingIds.has(id));
  const toRemove = existing.filter((e) => !desired.includes(e.classId));

  await prisma.$transaction(async (tx) => {
    if (toRemove.length) await tx.examClass.deleteMany({ where: { id: { in: toRemove.map((r) => r.id) } } });
    if (toAdd.length) {
      await tx.examClass.createMany({ data: toAdd.map((classId) => ({ tenantId: scope.tenantId, schoolId: scope.schoolId, academicSessionId: requireSession(scope), examId, classId })) });
    }
    if (toAdd.length) await recordAudit(tx, scope, "EXAM_CLASS_ASSIGNED", "Exam", examId, { added: toAdd });
    if (toRemove.length) await recordAudit(tx, scope, "EXAM_CLASS_REMOVED", "Exam", examId, { removed: toRemove.map((r) => r.classId) });
  });

  const rows = await prisma.examClass.findMany({ where: { examId }, orderBy: [{ class: { order: "asc" } }], select: { class: { select: { id: true, name: true } } } });
  return rows.map((r) => r.class);
}
