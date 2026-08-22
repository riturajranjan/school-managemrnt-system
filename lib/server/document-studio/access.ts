// Shared helpers for Document Studio (Phase 9V). A subject is always a real,
// active Student.id or Staff.id — never a parallel identity.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";

export function staffDisplayName(s: { firstName: string; lastName: string | null; displayName: string | null }): string {
  return s.displayName?.trim() || `${s.firstName} ${s.lastName ?? ""}`.trim();
}

export function studentDisplayName(s: { firstName: string; lastName: string | null }): string {
  return `${s.firstName} ${s.lastName ?? ""}`.trim();
}

export async function resolveDocumentBranch(scope: OrgScope): Promise<string> {
  if (scope.branchId) return scope.branchId;
  const active = await prisma.branch.findMany({ where: { schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (active.length === 1) return active[0].id;
  throw new HttpError("INVALID_BRANCH", "Select a branch for Document Studio");
}

export async function requireValidStudent(scope: OrgScope, studentId: string): Promise<{ id: string; branchId: string }> {
  const student = await prisma.student.findFirst({ where: { id: studentId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true, branchId: true } });
  if (!student) throw new HttpError("INVALID_DOCUMENT_SUBJECT", "Student must be a real, active student in this school");
  return student;
}

export async function requireValidStaff(scope: OrgScope, staffId: string): Promise<{ id: string; branchId: string }> {
  const staff = await prisma.staff.findFirst({ where: { id: staffId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true, branchId: true } });
  if (!staff) throw new HttpError("INVALID_DOCUMENT_SUBJECT", "Staff member must be real and active in this school");
  return staff;
}
