// User Account Creation Foundation review — a Teacher's account-provisioning
// and account-management authority is scoped to students they actually
// teach, never the whole school. "Teach" means a real TeachingAssignment
// (Section + Subject + Staff), the same authoritative source every other
// teacher-ownership check in this codebase already uses (Homework,
// Lesson Plans, Marks entry) — never re-derived independently here.
import { prisma } from "@/lib/db/prisma";
import type { OrgScope } from "@/lib/server/api/scope";

/**
 * The real Student ids currently enrolled in any section this Staff member
 * (resolved from `teacherUserId`, i.e. Staff.userId === caller) has a
 * TeachingAssignment for, within the caller's own school. Empty set — never
 * an error — for a caller with no linked Staff record or no assignments.
 */
export async function getTeacherOwnedStudentIds(scope: OrgScope, teacherUserId: string): Promise<Set<string>> {
  const staff = await prisma.staff.findFirst({
    where: { userId: teacherUserId, schoolId: scope.schoolId },
    select: { id: true },
  });
  if (!staff) return new Set();

  const assignments = await prisma.teachingAssignment.findMany({
    where: { staffId: staff.id, schoolId: scope.schoolId },
    select: { sectionId: true },
  });
  const sectionIds = [...new Set(assignments.map((a) => a.sectionId))];
  if (sectionIds.length === 0) return new Set();

  const enrollments = await prisma.enrollment.findMany({
    where: { sectionId: { in: sectionIds }, schoolId: scope.schoolId, status: "ENROLLED" },
    select: { studentId: true },
  });
  return new Set(enrollments.map((e) => e.studentId));
}
