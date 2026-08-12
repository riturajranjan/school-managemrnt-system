// Academics FOUNDATION service (Phase 6-pre) — Class / Section / Enrollment only.
//
// The minimum real academic grouping required to unblock Attendance. Every
// query/mutation is constrained to the caller's validated OrgScope (tenant +
// school + academic session); a Section is additionally branch-scoped. Students
// enrolled must be real, ACTIVE, and belong to the same school/session/branch —
// never trusted from the browser. NOT a broad Academics module (no subjects/
// timetable/exams/marks).
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ClassDto, EnrollableStudentDto, RosterEntryDto, SectionDto } from "@/lib/api/contracts";

// Academics is always session-scoped; a school + academic session must be selected.
function requireSession(scope: OrgScope): string {
  if (!scope.academicSessionId) throw new HttpError("INVALID_SESSION", "Select an academic session first");
  return scope.academicSessionId;
}

export const createClassSchema = z.object({ name: z.string().trim().min(1).max(60), order: z.number().int().min(0).max(1000).optional() });
export const updateClassSchema = z.object({ name: z.string().trim().min(1).max(60).optional(), order: z.number().int().min(0).max(1000).optional(), status: z.enum(["active", "archived"]).optional() });
export const createSectionSchema = z.object({ classId: z.string().min(1), name: z.string().trim().min(1).max(20), capacity: z.number().int().min(1).max(200).optional() });
export const updateSectionSchema = z.object({ name: z.string().trim().min(1).max(20).optional(), capacity: z.number().int().min(1).max(200).optional(), status: z.enum(["active", "archived"]).optional() });
export const enrollSchema = z.object({ studentIds: z.array(z.string().min(1)).min(1).max(500) });

const CLASS_STATUS = { active: "ACTIVE", archived: "ARCHIVED" } as const;

// ── Classes ──────────────────────────────────────────────────────────────

type ClassRow = { id: string; name: string; order: number; status: string; sections?: { capacity: number }[]; _count?: { sections: number; enrollments: number } };
function classDto(c: ClassRow): ClassDto {
  return {
    id: c.id, name: c.name, order: c.order, status: c.status.toLowerCase(),
    sectionCount: c._count?.sections ?? 0,
    capacity: (c.sections ?? []).reduce((sum, s) => sum + s.capacity, 0),
    enrolledCount: c._count?.enrollments ?? 0,
  };
}

const classInclude = { sections: { select: { capacity: true } }, _count: { select: { sections: true, enrollments: { where: { status: "ENROLLED" as const } } } } } satisfies Prisma.ClassInclude;

export async function listClasses(scope: OrgScope): Promise<ClassDto[]> {
  const rows = await prisma.class.findMany({
    where: { schoolId: scope.schoolId, academicSessionId: requireSession(scope) },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: classInclude,
  });
  return rows.map(classDto);
}

export async function createClass(scope: OrgScope, raw: unknown): Promise<ClassDto> {
  const input = parseInput(createClassSchema, raw);
  const clash = await prisma.class.findFirst({ where: { schoolId: scope.schoolId, academicSessionId: requireSession(scope), name: input.name }, select: { id: true } });
  if (clash) throw new HttpError("CONFLICT", "A class with this name already exists in the session");
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.class.create({
      data: { tenantId: scope.tenantId, schoolId: scope.schoolId, academicSessionId: requireSession(scope), name: input.name, order: input.order ?? 0 },
      include: classInclude,
    });
    await recordAudit(tx, scope, "CLASS_CREATED", "Class", row.id, { name: row.name });
    return row;
  });
  return classDto(created);
}

async function requireClassInScope(scope: OrgScope, classId: string) {
  const cls = await prisma.class.findFirst({ where: { id: classId, schoolId: scope.schoolId, academicSessionId: requireSession(scope) }, select: { id: true } });
  if (!cls) throw new HttpError("NOT_FOUND", "Class not found");
  return cls;
}

export async function getClass(scope: OrgScope, classId: string): Promise<ClassDto & { sections: SectionDto[] }> {
  await requireClassInScope(scope, classId);
  const cls = await prisma.class.findUniqueOrThrow({ where: { id: classId }, include: classInclude });
  const sections = await listSections(scope, classId);
  return { ...classDto(cls), sections };
}

export async function updateClass(scope: OrgScope, classId: string, raw: unknown): Promise<ClassDto> {
  const input = parseInput(updateClassSchema, raw);
  await requireClassInScope(scope, classId);
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.class.update({
      where: { id: classId },
      data: { name: input.name, order: input.order, status: input.status ? CLASS_STATUS[input.status] : undefined },
      include: classInclude,
    });
    await recordAudit(tx, scope, "CLASS_UPDATED", "Class", classId);
    return row;
  });
  return classDto(updated);
}

// ── Sections ─────────────────────────────────────────────────────────────

type SectionRow = { id: string; classId: string; name: string; capacity: number; status: string; branchId: string; class: { name: string }; _count?: { enrollments: number } };
function sectionDto(s: SectionRow): SectionDto {
  return { id: s.id, classId: s.classId, className: s.class.name, name: s.name, capacity: s.capacity, status: s.status.toLowerCase(), branchId: s.branchId, enrolledCount: s._count?.enrollments ?? 0 };
}
const sectionInclude = { class: { select: { name: true } }, _count: { select: { enrollments: { where: { status: "ENROLLED" as const } } } } } satisfies Prisma.SectionInclude;

/** The branch a new section belongs to: the active branch, else the school's single ACTIVE branch. */
async function resolveSectionBranch(scope: OrgScope): Promise<string> {
  if (scope.branchId) return scope.branchId;
  const active = await prisma.branch.findMany({ where: { schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (active.length === 1) return active[0].id;
  throw new HttpError("INVALID_BRANCH", "Select a branch before creating a section");
}

export async function listSections(scope: OrgScope, classId?: string): Promise<SectionDto[]> {
  const rows = await prisma.section.findMany({
    where: { schoolId: scope.schoolId, academicSessionId: requireSession(scope), ...(classId ? { classId } : {}) },
    include: sectionInclude,
    orderBy: [{ class: { order: "asc" } }, { name: "asc" }],
  });
  return rows.map(sectionDto);
}

export async function createSection(scope: OrgScope, raw: unknown): Promise<SectionDto> {
  const input = parseInput(createSectionSchema, raw);
  await requireClassInScope(scope, input.classId);
  const branchId = await resolveSectionBranch(scope);
  const clash = await prisma.section.findFirst({ where: { classId: input.classId, name: input.name }, select: { id: true } });
  if (clash) throw new HttpError("CONFLICT", "A section with this name already exists in the class");
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.section.create({
      data: { tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, academicSessionId: requireSession(scope), classId: input.classId, name: input.name, capacity: input.capacity ?? 40 },
      include: sectionInclude,
    });
    await recordAudit(tx, scope, "SECTION_CREATED", "Section", row.id, { classId: input.classId, name: row.name });
    return row;
  });
  return sectionDto(created);
}

async function requireSectionInScope(scope: OrgScope, sectionId: string) {
  const s = await prisma.section.findFirst({ where: { id: sectionId, schoolId: scope.schoolId, academicSessionId: requireSession(scope) }, select: { id: true, branchId: true } });
  if (!s) throw new HttpError("NOT_FOUND", "Section not found");
  return s;
}

export async function updateSection(scope: OrgScope, sectionId: string, raw: unknown): Promise<SectionDto> {
  const input = parseInput(updateSectionSchema, raw);
  await requireSectionInScope(scope, sectionId);
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.section.update({
      where: { id: sectionId },
      data: { name: input.name, capacity: input.capacity, status: input.status ? CLASS_STATUS[input.status] : undefined },
      include: sectionInclude,
    });
    await recordAudit(tx, scope, "SECTION_UPDATED", "Section", sectionId);
    return row;
  });
  return sectionDto(updated);
}

// ── Enrollment ───────────────────────────────────────────────────────────

type EnrollmentRow = {
  id: string; rollNumber: string | null; status: string;
  student: { id: string; firstName: string; lastName: string; admissionNumber: string; rollNumber: string | null; status: string };
};
function rosterDto(e: EnrollmentRow): RosterEntryDto {
  return {
    enrollmentId: e.id, status: e.status.toLowerCase(), rollNumber: e.rollNumber ?? e.student.rollNumber,
    student: { id: e.student.id, name: `${e.student.firstName} ${e.student.lastName}`.trim(), admissionNumber: e.student.admissionNumber, status: e.student.status.toLowerCase() },
  };
}

export async function listRoster(scope: OrgScope, sectionId: string): Promise<RosterEntryDto[]> {
  await requireSectionInScope(scope, sectionId);
  const rows = await prisma.enrollment.findMany({
    where: { sectionId, status: "ENROLLED" },
    include: { student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true, rollNumber: true, status: true } } },
    orderBy: [{ student: { firstName: "asc" } }],
  });
  return rows.map(rosterDto);
}

/** ACTIVE students in scope not yet enrolled in ANY section this academic session. */
export async function listEnrollableStudents(scope: OrgScope): Promise<EnrollableStudentDto[]> {
  const enrolled = await prisma.enrollment.findMany({ where: { schoolId: scope.schoolId, academicSessionId: requireSession(scope), status: "ENROLLED" }, select: { studentId: true } });
  const students = await prisma.student.findMany({
    where: {
      schoolId: scope.schoolId, academicSessionId: requireSession(scope), status: "ACTIVE",
      id: { notIn: enrolled.length ? enrolled.map((e) => e.studentId) : ["__none__"] },
    },
    select: { id: true, firstName: true, lastName: true, admissionNumber: true, classLabel: true, sectionLabel: true },
    orderBy: [{ firstName: "asc" }],
    take: 1000,
  });
  return students.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`.trim(), admissionNumber: s.admissionNumber, classLabel: s.classLabel, sectionLabel: s.sectionLabel }));
}

/** Enroll students into a section. Validates each is real, ACTIVE, in-scope, same branch, and not already enrolled this session. */
export async function enrollStudents(scope: OrgScope, sectionId: string, raw: unknown): Promise<RosterEntryDto[]> {
  const { studentIds } = parseInput(enrollSchema, raw);
  const section = await requireSectionInScope(scope, sectionId);
  const unique = [...new Set(studentIds)];

  const section2 = await prisma.section.findUniqueOrThrow({ where: { id: sectionId }, select: { classId: true } });
  const students = await prisma.student.findMany({
    where: { id: { in: unique }, schoolId: scope.schoolId, academicSessionId: requireSession(scope), branchId: section.branchId, status: "ACTIVE" },
    select: { id: true, rollNumber: true },
  });
  if (students.length !== unique.length) throw new HttpError("VALIDATION_ERROR", "One or more students are not valid, active, or in this section's branch");

  // Reject any student already enrolled elsewhere this session (unique per session).
  const already = await prisma.enrollment.findMany({ where: { academicSessionId: requireSession(scope), studentId: { in: unique } }, select: { studentId: true } });
  if (already.length) throw new HttpError("CONFLICT", "One or more students are already enrolled this academic session");

  await prisma.$transaction(async (tx) => {
    await tx.enrollment.createMany({
      data: students.map((s) => ({ tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: section.branchId, academicSessionId: requireSession(scope), classId: section2.classId, sectionId, studentId: s.id, rollNumber: s.rollNumber, status: "ENROLLED" as const })),
    });
    await recordAudit(tx, scope, "STUDENT_ENROLLED", "Section", sectionId, { count: students.length });
  });
  return listRoster(scope, sectionId);
}

/** Remove an enrollment (validated in-scope). */
export async function unenroll(scope: OrgScope, enrollmentId: string): Promise<{ id: string }> {
  const row = await prisma.enrollment.findFirst({ where: { id: enrollmentId, schoolId: scope.schoolId, academicSessionId: requireSession(scope) }, select: { id: true, sectionId: true, studentId: true } });
  if (!row) throw new HttpError("NOT_FOUND", "Enrollment not found");
  await prisma.$transaction(async (tx) => {
    await tx.enrollment.delete({ where: { id: enrollmentId } });
    await recordAudit(tx, scope, "STUDENT_UNENROLLED", "Section", row.sectionId, { studentId: row.studentId });
  });
  return { id: enrollmentId };
}
