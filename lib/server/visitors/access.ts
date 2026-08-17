// Shared broad-manager check for Visitor Management (Phase 9I) — no real
// RECEPTIONIST DB role exists (mock-only), so this mirrors Fees/Accounting/
// Payroll's access.ts exactly (SCHOOL_ADMIN only; PRINCIPAL is view-only
// oversight via visitors.view).
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";

const VISITOR_MANAGER_ROLE_KEYS = ["SCHOOL_ADMIN"];

export async function isBroadVisitorManager(scope: OrgScope): Promise<boolean> {
  const m = await prisma.roleAssignment.findFirst({
    where: { membership: { userId: scope.actor.id, tenantId: scope.tenantId, status: "ACTIVE" }, role: { key: { in: VISITOR_MANAGER_ROLE_KEYS } } },
    select: { id: true },
  });
  return Boolean(m);
}

/** Resolve the branch a new VisitorVisit belongs to (active branch, else single ACTIVE) — mirrors lib/server/payroll/access.ts's resolvePayrollBranch. */
export async function resolveVisitorBranch(scope: OrgScope): Promise<string> {
  if (scope.branchId) return scope.branchId;
  const active = await prisma.branch.findMany({ where: { schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (active.length === 1) return active[0].id;
  throw new HttpError("INVALID_BRANCH", "Select a branch for this visit");
}
