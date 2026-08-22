// Shared helpers for Counseling / Student Wellbeing (Phase 9S). A student is
// always a real, active Student.id; a counselor is always a real, active
// Staff.id — never a parallel identity. counseling.viewConfidential is
// necessary but NOT sufficient to read another counselor's notes — ownership
// (assignedCounselorStaffId === the caller's own resolved Staff.id) is
// enforced uniformly here, with no senior/broad-access tier that bypasses it.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";

export function staffDisplayName(s: { firstName: string; lastName: string | null; displayName: string | null }): string {
  return s.displayName?.trim() || `${s.firstName} ${s.lastName ?? ""}`.trim();
}

export function studentDisplayName(s: { firstName: string; lastName: string | null }): string {
  return `${s.firstName} ${s.lastName ?? ""}`.trim();
}

export async function requireValidStudent(scope: OrgScope, studentId: string): Promise<{ id: string; branchId: string }> {
  const student = await prisma.student.findFirst({ where: { id: studentId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true, branchId: true } });
  if (!student) throw new HttpError("INVALID_COUNSELING_STUDENT", "Student must be a real, active student in this school");
  return student;
}

export async function requireValidCounselor(scope: OrgScope, staffId: string): Promise<{ id: string }> {
  const staff = await prisma.staff.findFirst({ where: { id: staffId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (!staff) throw new HttpError("INVALID_COUNSELING_COUNSELOR", "Counselor must be a real, active staff member in this school");
  return staff;
}

/** Resolve the acting user's own Staff record, if one exists. Never
 * fabricated — a user with no linked Staff row simply has no counselor
 * identity to attribute a session to. */
export async function resolveActingStaffId(scope: OrgScope): Promise<string | null> {
  const staff = await prisma.staff.findFirst({ where: { userId: scope.actor.id, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  return staff?.id ?? null;
}

/** Require the acting user to resolve to a real, active Staff — a session
 * must always have a real counselor identity, never a fabricated one. */
export async function requireActingStaffId(scope: OrgScope): Promise<string> {
  const staffId = await resolveActingStaffId(scope);
  if (!staffId) throw new HttpError("INVALID_COUNSELING_COUNSELOR", "You have no linked Staff record to act as a counselor");
  return staffId;
}

/**
 * Ownership check for confidential content: the caller must be the case's
 * OWN assigned counselor. Returns 404 (not 403) when ownership fails, since
 * revealing that a confidential case/session exists for a case you don't own
 * is itself information the caller should not receive.
 */
export async function requireOwnCaseForConfidential(scope: OrgScope, caseAssignedCounselorStaffId: string | null): Promise<void> {
  const actingStaffId = await resolveActingStaffId(scope);
  if (!actingStaffId || !caseAssignedCounselorStaffId || actingStaffId !== caseAssignedCounselorStaffId) {
    throw new HttpError("COUNSELING_CASE_NOT_FOUND", "Case not found");
  }
}
