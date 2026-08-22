// Shared helpers for Health / Infirmary Management (Phase 9R). A patient is
// always a real, active Student.id or Staff.id — never a parallel identity.
// health.manage is granted only to SCHOOL_ADMIN in the real catalog (no
// dedicated nurse/health-manager role exists yet) — mirrors
// lib/server/hostel/access.ts's reasoning.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";

export async function resolveHealthBranch(scope: OrgScope): Promise<string> {
  if (scope.branchId) return scope.branchId;
  const active = await prisma.branch.findMany({ where: { schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (active.length === 1) return active[0].id;
  throw new HttpError("INVALID_BRANCH", "Select a branch for health records");
}

export function staffDisplayName(s: { firstName: string; lastName: string | null; displayName: string | null }): string {
  return s.displayName?.trim() || `${s.firstName} ${s.lastName ?? ""}`.trim();
}

export function studentDisplayName(s: { firstName: string; lastName: string | null }): string {
  return `${s.firstName} ${s.lastName ?? ""}`.trim();
}

export type PatientRef = { studentId: string | null; staffId: string | null };

/**
 * Validate exactly one of studentId/staffId is provided and resolves to a
 * real, active identity in this school. Returns the resolved branchId (from
 * the patient's own record) so the caller never has to guess one.
 */
export async function requireValidPatient(scope: OrgScope, input: { studentId?: string; staffId?: string }): Promise<{ studentId: string | null; staffId: string | null; branchId: string }> {
  const hasStudent = Boolean(input.studentId);
  const hasStaff = Boolean(input.staffId);
  if (hasStudent === hasStaff) throw new HttpError("INVALID_HEALTH_PATIENT", "Exactly one of studentId/staffId is required");

  if (hasStudent) {
    const student = await prisma.student.findFirst({ where: { id: input.studentId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true, branchId: true } });
    if (!student) throw new HttpError("INVALID_HEALTH_PATIENT", "Patient must be a real, active student in this school");
    return { studentId: student.id, staffId: null, branchId: student.branchId };
  }

  const staff = await prisma.staff.findFirst({ where: { id: input.staffId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true, branchId: true } });
  if (!staff) throw new HttpError("INVALID_HEALTH_PATIENT", "Patient must be a real, active staff member in this school");
  return { studentId: null, staffId: staff.id, branchId: staff.branchId };
}

/** Resolve the acting user's own Staff record, if one exists — used to attribute
 * attendedByStaffId/administeredByStaffId to a real Staff identity when possible.
 * Never required: a School Admin without a Staff record can still act, just leaves it null. */
export async function resolveActingStaffId(scope: OrgScope): Promise<string | null> {
  const staff = await prisma.staff.findFirst({ where: { userId: scope.actor.id, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  return staff?.id ?? null;
}
