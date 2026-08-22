// Shared helpers for Inventory Management (Phase 9O). No dedicated real
// "storekeeper" DB role exists, so inventory.manage is only ever held by
// SCHOOL_ADMIN — mirrors lib/server/library/access.ts's reasoning exactly.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";

const INVENTORY_MANAGER_ROLE_KEYS = ["SCHOOL_ADMIN"];

export async function isBroadInventoryManager(scope: OrgScope): Promise<boolean> {
  const m = await prisma.roleAssignment.findFirst({
    where: { membership: { userId: scope.actor.id, tenantId: scope.tenantId, status: "ACTIVE" }, role: { key: { in: INVENTORY_MANAGER_ROLE_KEYS } } },
    select: { id: true },
  });
  return Boolean(m);
}

/** Resolve the branch a new Inventory row belongs to (active branch, else single ACTIVE). */
export async function resolveInventoryBranch(scope: OrgScope): Promise<string> {
  if (scope.branchId) return scope.branchId;
  const active = await prisma.branch.findMany({ where: { schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (active.length === 1) return active[0].id;
  throw new HttpError("INVALID_BRANCH", "Select a branch for inventory");
}

export function staffDisplayName(s: { firstName: string; lastName: string | null; displayName: string | null }): string {
  return s.displayName?.trim() || `${s.firstName} ${s.lastName ?? ""}`.trim();
}

export function studentDisplayName(s: { firstName: string; lastName: string | null }): string {
  return `${s.firstName} ${s.lastName ?? ""}`.trim();
}
