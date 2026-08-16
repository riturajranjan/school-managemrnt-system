// Shared broad-manager check for Payroll (Phase 9H) — no real HR_MANAGER/
// ACCOUNTANT DB role exists, so this mirrors Fees/Accounting's access.ts
// exactly (SCHOOL_ADMIN only; PRINCIPAL is view-only oversight via
// payroll.view). Staff self-service payslip access is identity-based
// (Staff.userId), not gated by this check — see lib/server/payroll/payslips.ts.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";

const PAYROLL_MANAGER_ROLE_KEYS = ["SCHOOL_ADMIN"];

export async function isBroadPayrollManager(scope: OrgScope): Promise<boolean> {
  const m = await prisma.roleAssignment.findFirst({
    where: { membership: { userId: scope.actor.id, tenantId: scope.tenantId, status: "ACTIVE" }, role: { key: { in: PAYROLL_MANAGER_ROLE_KEYS } } },
    select: { id: true },
  });
  return Boolean(m);
}

/** Resolve the branch a new Payroll row belongs to (active branch, else single ACTIVE) — mirrors lib/server/accounting/access.ts's resolveAccountingBranch. */
export async function resolvePayrollBranch(scope: OrgScope): Promise<string> {
  if (scope.branchId) return scope.branchId;
  const active = await prisma.branch.findMany({ where: { schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (active.length === 1) return active[0].id;
  throw new HttpError("INVALID_BRANCH", "Select a branch for payroll");
}
