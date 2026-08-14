// Academics Core — Class↔Subject assignment service (Phase 6). Real, PostgreSQL-
// backed. Answers "what subjects are taught in this Class?" via the session-scoped
// ClassSubject join (real FK to Class + Subject), and resolves the subjects a
// Section inherits (Section → Class → ClassSubject → Subject) through
// getSubjectsForSection — the single resolver later phases (Timetable / Period
// Attendance / Exams / Marks) must reuse rather than duplicate.
//
// Every id is re-validated against the caller's OrgScope; a foreign class/subject
// id fails closed. Only ACTIVE subjects of the SAME school may be NEWLY assigned;
// an already-assigned subject that is later archived is preserved (history stays
// readable). Routes enforce academics.view (read) / academics.manage (write).
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ClassSubjectDto, SubjectDto } from "@/lib/api/contracts";

function requireSession(scope: OrgScope): string {
  if (!scope.academicSessionId) throw new HttpError("INVALID_SESSION", "Select an academic session first");
  return scope.academicSessionId;
}

export const assignSubjectSchema = z.object({ subjectId: z.string().min(1) });
export const reconcileSchema = z.object({ subjectIds: z.array(z.string().min(1)).max(200) });

// ── DTO ──────────────────────────────────────────────────────────────────

type ClassSubjectRow = {
  id: string; classId: string; subjectId: string; isCore: boolean; order: number;
  class: { name: string }; subject: { name: string; code: string; color: string };
};
function classSubjectDto(cs: ClassSubjectRow): ClassSubjectDto {
  return {
    id: cs.id, classId: cs.classId, className: cs.class.name,
    subjectId: cs.subjectId, subjectName: cs.subject.name, subjectCode: cs.subject.code, subjectColor: cs.subject.color,
    isCore: cs.isCore, order: cs.order,
  };
}
const classSubjectSelect = {
  id: true, classId: true, subjectId: true, isCore: true, order: true,
  class: { select: { name: true } },
  subject: { select: { name: true, code: true, color: true } },
} satisfies Prisma.ClassSubjectSelect;

// ── Scope guards ───────────────────────────────────────────────────────────

async function requireClassInScope(scope: OrgScope, classId: string): Promise<{ id: string }> {
  const c = await prisma.class.findFirst({
    where: { id: classId, schoolId: scope.schoolId, academicSessionId: requireSession(scope) },
    select: { id: true },
  });
  if (!c) throw new HttpError("NOT_FOUND", "Class not found");
  return c;
}

/** Load in-scope, ACTIVE subjects by id (rejects foreign-school / archived / missing). */
async function requireActiveSubjects(scope: OrgScope, subjectIds: string[]): Promise<void> {
  if (subjectIds.length === 0) return;
  const found = await prisma.subject.findMany({
    where: { id: { in: subjectIds }, schoolId: scope.schoolId, status: "ACTIVE" },
    select: { id: true },
  });
  if (found.length !== subjectIds.length) {
    throw new HttpError("VALIDATION_ERROR", "One or more subjects are not valid, active, or in this school");
  }
}

// ── Reads ──────────────────────────────────────────────────────────────────

const csOrder: Prisma.ClassSubjectOrderByWithRelationInput[] = [{ order: "asc" }, { subject: { name: "asc" } }];

export async function listClassSubjects(scope: OrgScope, classId: string): Promise<ClassSubjectDto[]> {
  await requireClassInScope(scope, classId);
  const rows = await prisma.classSubject.findMany({ where: { classId }, orderBy: csOrder, select: classSubjectSelect });
  return rows.map(classSubjectDto);
}

/** The classes a given subject is assigned to (session-scoped), for the subject detail. */
export async function listSubjectClasses(scope: OrgScope, subjectId: string): Promise<ClassSubjectDto[]> {
  const subject = await prisma.subject.findFirst({ where: { id: subjectId, schoolId: scope.schoolId }, select: { id: true } });
  if (!subject) throw new HttpError("NOT_FOUND", "Subject not found");
  const rows = await prisma.classSubject.findMany({
    where: { subjectId, schoolId: scope.schoolId, academicSessionId: requireSession(scope) },
    orderBy: [{ class: { order: "asc" } }, { class: { name: "asc" } }],
    select: classSubjectSelect,
  });
  return rows.map(classSubjectDto);
}

/**
 * Subjects a Section inherits from its Class (Section → Class → ClassSubject →
 * Subject). The single reusable resolver for downstream phases. Returns full
 * SubjectDto rows (classCount included) ordered by ClassSubject order.
 */
export async function getSubjectsForSection(scope: OrgScope, sectionId: string): Promise<SubjectDto[]> {
  const section = await prisma.section.findFirst({
    where: { id: sectionId, schoolId: scope.schoolId, academicSessionId: requireSession(scope) },
    select: { classId: true },
  });
  if (!section) throw new HttpError("NOT_FOUND", "Section not found");
  const rows = await prisma.classSubject.findMany({
    where: { classId: section.classId },
    orderBy: csOrder,
    select: {
      order: true,
      subject: {
        select: {
          id: true, code: true, name: true, shortName: true, department: true, type: true,
          gradeRangeStart: true, gradeRangeEnd: true, credit: true, passingMarks: true, maxMarks: true,
          theoryMarks: true, practicalMarks: true, color: true, order: true, status: true,
          _count: { select: { classSubjects: true } },
        },
      },
    },
  });
  const toUiType = (t: string) => t.toLowerCase().replace(/_/g, "-");
  return rows.map((r) => {
    const s = r.subject;
    return {
      id: s.id, code: s.code, name: s.name, shortName: s.shortName, department: s.department,
      type: toUiType(s.type) as SubjectDto["type"], gradeRangeStart: s.gradeRangeStart, gradeRangeEnd: s.gradeRangeEnd,
      credit: s.credit, passingMarks: s.passingMarks, maxMarks: s.maxMarks, theoryMarks: s.theoryMarks,
      practicalMarks: s.practicalMarks, color: s.color, order: s.order,
      status: s.status === "ACTIVE" ? "active" : "inactive", classCount: s._count.classSubjects,
    };
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

/** Assign a single ACTIVE subject to a class (idempotency: duplicate → 409). */
export async function assignSubject(scope: OrgScope, classId: string, raw: unknown): Promise<ClassSubjectDto> {
  const { subjectId } = parseInput(assignSubjectSchema, raw);
  await requireClassInScope(scope, classId);
  await requireActiveSubjects(scope, [subjectId]);
  const existing = await prisma.classSubject.findUnique({ where: { classId_subjectId: { classId, subjectId } }, select: { id: true } });
  if (existing) throw new HttpError("CONFLICT", "This subject is already assigned to the class");
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.classSubject.create({
      data: { tenantId: scope.tenantId, schoolId: scope.schoolId, academicSessionId: requireSession(scope), classId, subjectId },
      select: classSubjectSelect,
    });
    await recordAudit(tx, scope, "CLASS_SUBJECT_ASSIGNED", "ClassSubject", row.id, { classId, subjectId });
    return row;
  });
  return classSubjectDto(created);
}

/** Remove one class→subject assignment (validated in-scope). */
export async function removeClassSubject(scope: OrgScope, classId: string, assignmentId: string): Promise<{ id: string }> {
  await requireClassInScope(scope, classId);
  const row = await prisma.classSubject.findFirst({ where: { id: assignmentId, classId }, select: { id: true, subjectId: true } });
  if (!row) throw new HttpError("NOT_FOUND", "Assignment not found");
  await prisma.$transaction(async (tx) => {
    await tx.classSubject.delete({ where: { id: assignmentId } });
    await recordAudit(tx, scope, "CLASS_SUBJECT_REMOVED", "ClassSubject", assignmentId, { classId, subjectId: row.subjectId });
  });
  return { id: assignmentId };
}

/**
 * Atomically reconcile the FULL set of subjects for a class. Newly-added subjects
 * must be ACTIVE + in-school; already-assigned subjects that are later archived
 * are preserved when kept (history stays readable). One transaction + one audit.
 */
export async function reconcileClassSubjects(scope: OrgScope, classId: string, raw: unknown): Promise<ClassSubjectDto[]> {
  const { subjectIds } = parseInput(reconcileSchema, raw);
  await requireClassInScope(scope, classId);
  const desired = [...new Set(subjectIds)];

  const existing = await prisma.classSubject.findMany({ where: { classId }, select: { id: true, subjectId: true } });
  const existingIds = new Set(existing.map((e) => e.subjectId));
  const toAdd = desired.filter((id) => !existingIds.has(id));
  const toRemoveRows = existing.filter((e) => !desired.includes(e.subjectId));

  await requireActiveSubjects(scope, toAdd); // only NEW subjects must be active/in-school

  await prisma.$transaction(async (tx) => {
    if (toRemoveRows.length) await tx.classSubject.deleteMany({ where: { id: { in: toRemoveRows.map((r) => r.id) } } });
    if (toAdd.length) {
      await tx.classSubject.createMany({
        data: toAdd.map((subjectId, i) => ({
          tenantId: scope.tenantId, schoolId: scope.schoolId, academicSessionId: requireSession(scope), classId, subjectId, order: i,
        })),
      });
    }
    await recordAudit(tx, scope, "CLASS_SUBJECTS_UPDATED", "Class", classId, { added: toAdd.length, removed: toRemoveRows.length, total: desired.length });
  });

  const rows = await prisma.classSubject.findMany({ where: { classId }, orderBy: csOrder, select: classSubjectSelect });
  return rows.map(classSubjectDto);
}
