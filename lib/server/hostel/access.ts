// Shared helpers for Hostel Management (Phase 9Q). No dedicated real
// "warden"/"hostel manager" DB role exists, so hostel.manage is only ever
// held by SCHOOL_ADMIN — mirrors lib/server/library/access.ts's reasoning.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";

const HOSTEL_MANAGER_ROLE_KEYS = ["SCHOOL_ADMIN"];

export async function isBroadHostelManager(scope: OrgScope): Promise<boolean> {
  const m = await prisma.roleAssignment.findFirst({
    where: { membership: { userId: scope.actor.id, tenantId: scope.tenantId, status: "ACTIVE" }, role: { key: { in: HOSTEL_MANAGER_ROLE_KEYS } } },
    select: { id: true },
  });
  return Boolean(m);
}

export async function resolveHostelBranch(scope: OrgScope): Promise<string> {
  if (scope.branchId) return scope.branchId;
  const active = await prisma.branch.findMany({ where: { schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (active.length === 1) return active[0].id;
  throw new HttpError("INVALID_BRANCH", "Select a branch for hostel");
}

export function staffDisplayName(s: { firstName: string; lastName: string | null; displayName: string | null }): string {
  return s.displayName?.trim() || `${s.firstName} ${s.lastName ?? ""}`.trim();
}

export function studentDisplayName(s: { firstName: string; lastName: string | null }): string {
  return `${s.firstName} ${s.lastName ?? ""}`.trim();
}
