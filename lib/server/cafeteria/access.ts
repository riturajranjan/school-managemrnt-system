// Shared helpers for Cafeteria / Meal Management (Phase 9T). A meal consumer
// is always a real, active Student.id or Staff.id — never a parallel
// identity. cafeteria.manage is granted only to CAFETERIA_MANAGER in the
// real catalog (SCHOOL_ADMIN gets view only) — mirrors
// lib/server/counseling/access.ts's reasoning.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";

export function staffDisplayName(s: { firstName: string; lastName: string | null; displayName: string | null }): string {
  return s.displayName?.trim() || `${s.firstName} ${s.lastName ?? ""}`.trim();
}

export function studentDisplayName(s: { firstName: string; lastName: string | null }): string {
  return `${s.firstName} ${s.lastName ?? ""}`.trim();
}

export async function resolveCafeteriaBranch(scope: OrgScope): Promise<string> {
  if (scope.branchId) return scope.branchId;
  const active = await prisma.branch.findMany({ where: { schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (active.length === 1) return active[0].id;
  throw new HttpError("INVALID_BRANCH", "Select a branch for cafeteria");
}

/** Resolve the single CafeteriaLocation for this school/branch when exactly
 * one exists — mirrors the single-branch auto-resolution pattern used
 * elsewhere. Requires explicit selection once more than one location exists. */
export async function resolveDefaultLocation(scope: OrgScope): Promise<string> {
  const locations = await prisma.cafeteriaLocation.findMany({
    where: { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}), status: "ACTIVE" },
    select: { id: true },
  });
  if (locations.length === 1) return locations[0].id;
  throw new HttpError("CAFETERIA_LOCATION_NOT_FOUND", "Select a cafeteria location");
}

export type ConsumerRef = { studentId: string | null; staffId: string | null };

export async function requireValidConsumer(scope: OrgScope, input: { studentId?: string; staffId?: string }): Promise<{ studentId: string | null; staffId: string | null; branchId: string }> {
  const hasStudent = Boolean(input.studentId);
  const hasStaff = Boolean(input.staffId);
  if (hasStudent === hasStaff) throw new HttpError("INVALID_CAFETERIA_CONSUMER", "Exactly one of studentId/staffId is required");

  if (hasStudent) {
    const student = await prisma.student.findFirst({ where: { id: input.studentId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true, branchId: true } });
    if (!student) throw new HttpError("INVALID_CAFETERIA_CONSUMER", "Consumer must be a real, active student in this school");
    return { studentId: student.id, staffId: null, branchId: student.branchId };
  }

  const staff = await prisma.staff.findFirst({ where: { id: input.staffId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true, branchId: true } });
  if (!staff) throw new HttpError("INVALID_CAFETERIA_CONSUMER", "Consumer must be a real, active staff member in this school");
  return { studentId: null, staffId: staff.id, branchId: staff.branchId };
}
