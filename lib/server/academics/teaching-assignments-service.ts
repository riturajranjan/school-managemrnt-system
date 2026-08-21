// Academics — Teaching assignments (Phase 6A). A real teacher (Staff) teaching a
// Subject in a Section. Real FKs to Section + Subject + Staff. Every authority is
// re-validated server-side against the caller's OrgScope:
//   • Section is in scope (school + session; branch when scoped).
//   • Subject is actually part of the Section's Class curriculum — validated via
//     the SINGLE resolver getSubjectsForSection (never an arbitrary subject).
//   • Staff exists, is ACTIVE, is teaching-eligible, same school + same branch.
//   • academicSession is derived from the Section (never trusted from the browser).
// Multiple teachers per (section, subject) are allowed; the same staff on the same
// (section, subject) is a duplicate → 409. Routes enforce academics.view/manage.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { StaffTeachingAssignmentDto, TeachingAssignmentDto, TeachingLoadSummaryDto } from "@/lib/api/contracts";
import { getSubjectsForSection } from "./class-subjects-service";

export const createAssignmentSchema = z.object({ subjectId: z.string().min(1), staffId: z.string().min(1), isPrimary: z.boolean().optional() });

function requireSession(scope: OrgScope): string {
  if (!scope.academicSessionId) throw new HttpError("INVALID_SESSION", "Select an academic session first");
  return scope.academicSessionId;
}

type Row = {
  id: string; sectionId: string; subjectId: string; staffId: string; isPrimary: boolean;
  subject: { name: string; code: string };
  staff: { firstName: string; lastName: string | null; displayName: string | null; employeeCode: string };
};
function dto(r: Row): TeachingAssignmentDto {
  const name = r.staff.displayName?.trim() || `${r.staff.firstName} ${r.staff.lastName ?? ""}`.trim();
  return {
    id: r.id, sectionId: r.sectionId, subjectId: r.subjectId, subjectName: r.subject.name, subjectCode: r.subject.code,
    staffId: r.staffId, staffName: name, staffEmployeeCode: r.staff.employeeCode, isPrimary: r.isPrimary,
  };
}
const select = {
  id: true, sectionId: true, subjectId: true, staffId: true, isPrimary: true,
  subject: { select: { name: true, code: true } },
  staff: { select: { firstName: true, lastName: true, displayName: true, employeeCode: true } },
} satisfies Prisma.TeachingAssignmentSelect;

async function requireSectionInScope(scope: OrgScope, sectionId: string): Promise<{ id: string; branchId: string; academicSessionId: string }> {
  const s = await prisma.section.findFirst({
    where: { id: sectionId, schoolId: scope.schoolId, academicSessionId: requireSession(scope), ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select: { id: true, branchId: true, academicSessionId: true },
  });
  if (!s) throw new HttpError("NOT_FOUND", "Section not found");
  return s;
}

const orderBy: Prisma.TeachingAssignmentOrderByWithRelationInput[] = [{ subject: { name: "asc" } }, { staff: { firstName: "asc" } }];

export async function listTeachingAssignments(scope: OrgScope, sectionId: string): Promise<TeachingAssignmentDto[]> {
  await requireSectionInScope(scope, sectionId);
  const rows = await prisma.teachingAssignment.findMany({ where: { sectionId }, orderBy, select });
  return rows.map(dto);
}

const staffAssignmentSelect = {
  id: true, isPrimary: true,
  subject: { select: { id: true, code: true, name: true, color: true } },
  section: { select: { id: true, name: true, classId: true, class: { select: { name: true } } } },
} satisfies Prisma.TeachingAssignmentSelect;

/** A Staff/teacher's own real assignments across all sections (Phase 9J — Teacher Classes/Detail). Session-scoped like every other TeachingAssignment read. */
export async function listTeachingAssignmentsForStaff(scope: OrgScope, staffId: string): Promise<StaffTeachingAssignmentDto[]> {
  const staff = await prisma.staff.findFirst({ where: { id: staffId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true } });
  if (!staff) throw new HttpError("NOT_FOUND", "Staff member not found");
  const rows = await prisma.teachingAssignment.findMany({
    where: { staffId, academicSessionId: requireSession(scope) },
    orderBy: [{ section: { name: "asc" } }, { subject: { name: "asc" } }],
    select: staffAssignmentSelect,
  });
  return rows.map((r) => ({
    id: r.id, isPrimary: r.isPrimary,
    section: { id: r.section.id, name: r.section.name, classId: r.section.classId, className: r.section.class.name },
    subject: { id: r.subject.id, code: r.subject.code, name: r.subject.name, color: r.subject.color },
  }));
}

/**
 * Bulk per-staff teaching load for a Teachers-directory list (Phase 9J) — one
 * grouped query per domain instead of N+1 per row. `weeklyPeriods` counts each
 * staff's real TimetableEntry rows this session (an honest, derived figure —
 * never a fabricated workload number).
 */
export async function getTeachingLoadSummary(scope: OrgScope, staffIds: string[]): Promise<Map<string, TeachingLoadSummaryDto>> {
  const result = new Map<string, TeachingLoadSummaryDto>();
  if (staffIds.length === 0 || !scope.academicSessionId) return result;
  const [assignments, periodCounts] = await Promise.all([
    prisma.teachingAssignment.findMany({
      where: { staffId: { in: staffIds }, academicSessionId: scope.academicSessionId },
      select: { staffId: true, sectionId: true, subject: { select: { id: true, name: true, shortName: true } } },
    }),
    prisma.timetableEntry.groupBy({ by: ["staffId"], where: { staffId: { in: staffIds }, academicSessionId: scope.academicSessionId }, _count: { _all: true } }),
  ]);
  const weeklyPeriods = new Map(periodCounts.map((p) => [p.staffId, p._count._all]));
  for (const staffId of staffIds) result.set(staffId, { staffId, subjects: [], sectionCount: 0, weeklyPeriods: weeklyPeriods.get(staffId) ?? 0 });
  for (const a of assignments) {
    const entry = result.get(a.staffId);
    if (!entry) continue;
    if (!entry.subjects.some((s) => s.id === a.subject.id)) entry.subjects.push({ id: a.subject.id, name: a.subject.name, shortName: a.subject.shortName });
  }
  const sections = new Map<string, Set<string>>();
  for (const a of assignments) {
    if (!sections.has(a.staffId)) sections.set(a.staffId, new Set());
    sections.get(a.staffId)!.add(a.sectionId);
  }
  for (const [staffId, set] of sections) {
    const entry = result.get(staffId);
    if (entry) entry.sectionCount = set.size;
  }
  return result;
}

export async function createTeachingAssignment(scope: OrgScope, sectionId: string, raw: unknown): Promise<TeachingAssignmentDto> {
  const input = parseInput(createAssignmentSchema, raw);
  const section = await requireSectionInScope(scope, sectionId);

  // Subject MUST be part of the Section's Class curriculum (reuse the one resolver).
  const offered = await getSubjectsForSection(scope, sectionId);
  if (!offered.some((s) => s.id === input.subjectId)) {
    throw new HttpError("VALIDATION_ERROR", "That subject is not offered by this section's class");
  }

  // Staff must exist, be ACTIVE, teaching-eligible, same school + same branch.
  const staff = await prisma.staff.findFirst({
    where: { id: input.staffId, schoolId: scope.schoolId, status: "ACTIVE", isTeaching: true },
    select: { id: true, branchId: true },
  });
  if (!staff) throw new HttpError("VALIDATION_ERROR", "Staff member is not a valid, active, teaching employee in this school");
  if (staff.branchId !== section.branchId) throw new HttpError("VALIDATION_ERROR", "Teacher belongs to a different branch than this section");

  const existing = await prisma.teachingAssignment.findUnique({
    where: { sectionId_subjectId_staffId: { sectionId, subjectId: input.subjectId, staffId: input.staffId } },
    select: { id: true },
  });
  if (existing) throw new HttpError("CONFLICT", "This teacher is already assigned to this subject in this section");

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.teachingAssignment.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: section.branchId, academicSessionId: section.academicSessionId,
        sectionId, subjectId: input.subjectId, staffId: input.staffId, isPrimary: input.isPrimary ?? true,
      },
      select,
    });
    await recordAudit(tx, scope, "TEACHING_ASSIGNMENT_CREATED", "TeachingAssignment", row.id, { sectionId, subjectId: input.subjectId, staffId: input.staffId });
    return row;
  });
  return dto(created);
}

export async function removeTeachingAssignment(scope: OrgScope, sectionId: string, assignmentId: string): Promise<{ id: string }> {
  await requireSectionInScope(scope, sectionId);
  const row = await prisma.teachingAssignment.findFirst({ where: { id: assignmentId, sectionId }, select: { id: true, subjectId: true, staffId: true } });
  if (!row) throw new HttpError("NOT_FOUND", "Teaching assignment not found");
  await prisma.$transaction(async (tx) => {
    await tx.teachingAssignment.delete({ where: { id: assignmentId } });
    await recordAudit(tx, scope, "TEACHING_ASSIGNMENT_REMOVED", "TeachingAssignment", assignmentId, { sectionId, subjectId: row.subjectId, staffId: row.staffId });
  });
  return { id: assignmentId };
}
