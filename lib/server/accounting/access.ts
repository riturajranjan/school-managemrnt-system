// Shared broad-manager check for Accounting (Phase 9G) — no real ACCOUNTANT/
// BILLING DB role exists, so this mirrors Fees' access.ts exactly
// (SCHOOL_ADMIN only; PRINCIPAL is view-only oversight via accounting.view).
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";

const ACCOUNTING_MANAGER_ROLE_KEYS = ["SCHOOL_ADMIN"];

export async function isBroadAccountingManager(scope: OrgScope): Promise<boolean> {
  const m = await prisma.roleAssignment.findFirst({
    where: { membership: { userId: scope.actor.id, tenantId: scope.tenantId, status: "ACTIVE" }, role: { key: { in: ACCOUNTING_MANAGER_ROLE_KEYS } } },
    select: { id: true },
  });
  return Boolean(m);
}

/** Resolve the branch a new JournalEntry belongs to (active branch, else single ACTIVE) — mirrors lib/server/fees/structures.ts's resolveStructureBranch. */
export async function resolveAccountingBranch(scope: OrgScope): Promise<string> {
  if (scope.branchId) return scope.branchId;
  const active = await prisma.branch.findMany({ where: { schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (active.length === 1) return active[0].id;
  throw new HttpError("INVALID_BRANCH", "Select a branch for this journal entry");
}
