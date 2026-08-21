// Shared helpers for Transport (Phase 9M). Unlike Fees/Payroll/Visitors,
// Transport's real permission catalog already maps 1:1 to the intended
// manager tier (only TRANSPORT_MANAGER holds transport.manage; SCHOOL_ADMIN
// holds transport.view only) — so route-level `requirePermission("transport.manage")`
// is itself the correct gate, no extra role-key check needed.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";

/** Resolve the branch a new Transport row belongs to (active branch, else single ACTIVE) — mirrors lib/server/payroll/access.ts's resolvePayrollBranch. */
export async function resolveTransportBranch(scope: OrgScope): Promise<string> {
  if (scope.branchId) return scope.branchId;
  const active = await prisma.branch.findMany({ where: { schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (active.length === 1) return active[0].id;
  throw new HttpError("INVALID_BRANCH", "Select a branch for transport");
}

export function displayName(s: { firstName: string; lastName: string | null; displayName: string | null }): string {
  return s.displayName?.trim() || `${s.firstName} ${s.lastName ?? ""}`.trim();
}
