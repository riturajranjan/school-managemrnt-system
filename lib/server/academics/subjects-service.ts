// Academics Core — Subject catalogue service (Phase 6). Real, PostgreSQL-backed.
//
// The Subject catalogue is SCHOOL-scoped (a stable catalogue reused across
// academic sessions); which subjects a Class teaches is the session-scoped
// ClassSubject join handled in ./class-subjects-service. Every query/mutation is
// constrained to the caller's validated OrgScope (never a browser-supplied id) —
// a foreign school id simply matches nothing. Routes enforce academics.view (read)
// / academics.manage (write). No plan-feature gate: Academics is not plan-
// controlled here (mirrors the existing Class/Section foundation).
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { SubjectDto, SubjectType } from "@/lib/api/contracts";

// UI kebab ↔ DB enum for subject type.
const TYPE_TO_DB: Record<SubjectType, string> = {
  core: "CORE", elective: "ELECTIVE", optional: "OPTIONAL",
  practical: "PRACTICAL", language: "LANGUAGE", "co-curricular": "CO_CURRICULAR",
};
const typeToUi = (t: string): SubjectType => t.toLowerCase().replace(/_/g, "-") as SubjectType;
// UI status ("active" | "inactive") ↔ DB enum (ACTIVE | ARCHIVED).
const statusToUi = (s: string) => (s === "ACTIVE" ? "active" : "inactive");

const typeEnum = z.enum(["core", "elective", "optional", "practical", "language", "co-curricular"]);

export const createSubjectSchema = z.object({
  name: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(10),
  shortName: z.string().trim().min(1).max(6),
  department: z.string().trim().min(1).max(60),
  type: typeEnum.default("core"),
  gradeRangeStart: z.number().int().min(0).max(13).default(0),
  gradeRangeEnd: z.number().int().min(0).max(13).default(13),
  credit: z.number().int().min(1).max(10).default(4),
  passingMarks: z.number().int().min(0).max(200).default(33),
  maxMarks: z.number().int().min(1).max(200).default(100),
  theoryMarks: z.number().int().min(0).max(200).default(100),
  practicalMarks: z.number().int().min(0).max(200).default(0),
  color: z.string().trim().min(1).max(20).default("#18b0c8"),
  order: z.number().int().min(0).max(1000).optional(),
});
// Update is a genuine PARTIAL patch: every field optional with NO defaults, so an
// omitted field is left UNCHANGED (never reset to a create-time default).
export const updateSubjectSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  code: z.string().trim().min(1).max(10).optional(),
  shortName: z.string().trim().min(1).max(6).optional(),
  department: z.string().trim().min(1).max(60).optional(),
  type: typeEnum.optional(),
  gradeRangeStart: z.number().int().min(0).max(13).optional(),
  gradeRangeEnd: z.number().int().min(0).max(13).optional(),
  credit: z.number().int().min(1).max(10).optional(),
  passingMarks: z.number().int().min(0).max(200).optional(),
  maxMarks: z.number().int().min(1).max(200).optional(),
  theoryMarks: z.number().int().min(0).max(200).optional(),
  practicalMarks: z.number().int().min(0).max(200).optional(),
  color: z.string().trim().min(1).max(20).optional(),
  order: z.number().int().min(0).max(1000).optional(),
});

// ── DTO ──────────────────────────────────────────────────────────────────

type SubjectRow = {
  id: string; code: string; name: string; shortName: string; department: string; type: string;
  gradeRangeStart: number; gradeRangeEnd: number; credit: number; passingMarks: number;
  maxMarks: number; theoryMarks: number; practicalMarks: number; color: string; order: number; status: string;
  _count?: { classSubjects: number };
};
function subjectDto(s: SubjectRow, classCount = s._count?.classSubjects ?? 0): SubjectDto {
  return {
    id: s.id, code: s.code, name: s.name, shortName: s.shortName, department: s.department,
    type: typeToUi(s.type), gradeRangeStart: s.gradeRangeStart, gradeRangeEnd: s.gradeRangeEnd,
    credit: s.credit, passingMarks: s.passingMarks, maxMarks: s.maxMarks, theoryMarks: s.theoryMarks,
    practicalMarks: s.practicalMarks, color: s.color, order: s.order, status: statusToUi(s.status), classCount,
  };
}
const subjectSelect = {
  id: true, code: true, name: true, shortName: true, department: true, type: true,
  gradeRangeStart: true, gradeRangeEnd: true, credit: true, passingMarks: true, maxMarks: true,
  theoryMarks: true, practicalMarks: true, color: true, order: true, status: true,
  _count: { select: { classSubjects: true } },
} satisfies Prisma.SubjectSelect;

// ── Reads ──────────────────────────────────────────────────────────────────

export type ListSubjectParams = { search?: string; status?: string; sort?: string; page?: number; pageSize?: number };

/** School-wide subject catalogue, optionally filtered/sorted/paginated (all server-side). */
export async function listSubjects(scope: OrgScope, params: ListSubjectParams = {}): Promise<SubjectDto[]> {
  const where: Prisma.SubjectWhereInput = { schoolId: scope.schoolId };
  if (params.status === "active") where.status = "ACTIVE";
  else if (params.status === "inactive") where.status = "ARCHIVED";
  if (params.search?.trim()) {
    const q = params.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
      { department: { contains: q, mode: "insensitive" } },
    ];
  }
  const orderBy: Prisma.SubjectOrderByWithRelationInput[] =
    params.sort === "name" ? [{ name: "asc" }] : [{ order: "asc" }, { name: "asc" }];
  const take = params.pageSize && params.pageSize > 0 ? params.pageSize : undefined;
  const skip = take && params.page && params.page > 1 ? (params.page - 1) * take : undefined;

  const rows = await prisma.subject.findMany({ where, orderBy, select: subjectSelect, take, skip });
  return rows.map((r) => subjectDto(r));
}

async function requireSubjectInScope(scope: OrgScope, subjectId: string): Promise<{ id: string; status: string }> {
  const s = await prisma.subject.findFirst({ where: { id: subjectId, schoolId: scope.schoolId }, select: { id: true, status: true } });
  if (!s) throw new HttpError("NOT_FOUND", "Subject not found");
  return s;
}

export async function getSubject(scope: OrgScope, subjectId: string): Promise<SubjectDto> {
  await requireSubjectInScope(scope, subjectId);
  const s = await prisma.subject.findUniqueOrThrow({ where: { id: subjectId }, select: subjectSelect });
  return subjectDto(s);
}

// ── Mutations ────────────────────────────────────────────────────────────────

async function assertCodeFree(scope: OrgScope, code: string, exceptId?: string): Promise<void> {
  const clash = await prisma.subject.findFirst({
    where: { schoolId: scope.schoolId, code: { equals: code, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (clash) throw new HttpError("CONFLICT", "A subject with this code already exists in this school");
}

export async function createSubject(scope: OrgScope, raw: unknown): Promise<SubjectDto> {
  const input = parseInput(createSubjectSchema, raw);
  await assertCodeFree(scope, input.code);
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.subject.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId,
        code: input.code, name: input.name, shortName: input.shortName, department: input.department,
        type: TYPE_TO_DB[input.type] as never, gradeRangeStart: input.gradeRangeStart, gradeRangeEnd: input.gradeRangeEnd,
        credit: input.credit, passingMarks: input.passingMarks, maxMarks: input.maxMarks,
        theoryMarks: input.theoryMarks, practicalMarks: input.practicalMarks, color: input.color, order: input.order ?? 0,
      },
      select: subjectSelect,
    });
    await recordAudit(tx, scope, "SUBJECT_CREATED", "Subject", row.id, { code: row.code, name: row.name });
    return row;
  });
  return subjectDto(created);
}

export async function updateSubject(scope: OrgScope, subjectId: string, raw: unknown): Promise<SubjectDto> {
  const input = parseInput(updateSubjectSchema, raw);
  await requireSubjectInScope(scope, subjectId);
  if (input.code) await assertCodeFree(scope, input.code, subjectId);
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.subject.update({
      where: { id: subjectId },
      data: {
        code: input.code, name: input.name, shortName: input.shortName, department: input.department,
        type: input.type ? (TYPE_TO_DB[input.type] as never) : undefined,
        gradeRangeStart: input.gradeRangeStart, gradeRangeEnd: input.gradeRangeEnd, credit: input.credit,
        passingMarks: input.passingMarks, maxMarks: input.maxMarks, theoryMarks: input.theoryMarks,
        practicalMarks: input.practicalMarks, color: input.color, order: input.order,
      },
      select: subjectSelect,
    });
    await recordAudit(tx, scope, "SUBJECT_UPDATED", "Subject", subjectId);
    return row;
  });
  return subjectDto(updated);
}

/** Archive (inactive) or restore (active) a subject. Archived subjects can't be newly assigned. */
export async function setSubjectStatus(scope: OrgScope, subjectId: string, uiStatus: "active" | "inactive"): Promise<SubjectDto> {
  await requireSubjectInScope(scope, subjectId);
  const dbStatus = uiStatus === "active" ? "ACTIVE" : "ARCHIVED";
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.subject.update({ where: { id: subjectId }, data: { status: dbStatus as never }, select: subjectSelect });
    await recordAudit(tx, scope, uiStatus === "active" ? "SUBJECT_RESTORED" : "SUBJECT_ARCHIVED", "Subject", subjectId);
    return row;
  });
  return subjectDto(updated);
}

/** Duplicate a subject into a fresh ACTIVE catalogue entry with a unique code. */
export async function duplicateSubject(scope: OrgScope, subjectId: string): Promise<SubjectDto> {
  await requireSubjectInScope(scope, subjectId);
  const src = await prisma.subject.findUniqueOrThrow({ where: { id: subjectId }, select: subjectSelect });
  // Find a free "<CODE>-COPY[-n]" code.
  let code = `${src.code}-COPY`.slice(0, 10);
  for (let i = 2; await prisma.subject.findFirst({ where: { schoolId: scope.schoolId, code: { equals: code, mode: "insensitive" } }, select: { id: true } }); i++) {
    code = `${src.code}-C${i}`.slice(0, 10);
  }
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.subject.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, code, name: `Copy of ${src.name}`.slice(0, 80),
        shortName: src.shortName, department: src.department, type: src.type as never,
        gradeRangeStart: src.gradeRangeStart, gradeRangeEnd: src.gradeRangeEnd, credit: src.credit,
        passingMarks: src.passingMarks, maxMarks: src.maxMarks, theoryMarks: src.theoryMarks,
        practicalMarks: src.practicalMarks, color: src.color, order: src.order, status: "ACTIVE",
      },
      select: subjectSelect,
    });
    await recordAudit(tx, scope, "SUBJECT_DUPLICATED", "Subject", row.id, { sourceId: subjectId });
    return row;
  });
  return subjectDto(created);
}
