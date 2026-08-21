// Shared helpers for Library (Phase 9N). Route-level guards use the real
// permission catalog directly (library.view/library.manage already map 1:1
// to the intended tiers) — mirrors lib/server/transport/access.ts's
// reasoning. isBroadLibraryManager exists only for the Action Inbox
// aggregator (Phase 9L), which needs a role check outside any specific
// request's permission context.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";

const LIBRARY_MANAGER_ROLE_KEYS = ["LIBRARIAN"];

export async function isBroadLibraryManager(scope: OrgScope): Promise<boolean> {
  const m = await prisma.roleAssignment.findFirst({
    where: { membership: { userId: scope.actor.id, tenantId: scope.tenantId, status: "ACTIVE" }, role: { key: { in: LIBRARY_MANAGER_ROLE_KEYS } } },
    select: { id: true },
  });
  return Boolean(m);
}

/** Resolve the branch a new Library row belongs to (active branch, else single ACTIVE). */
export async function resolveLibraryBranch(scope: OrgScope): Promise<string> {
  if (scope.branchId) return scope.branchId;
  const active = await prisma.branch.findMany({ where: { schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (active.length === 1) return active[0].id;
  throw new HttpError("INVALID_BRANCH", "Select a branch for the library");
}

export function staffDisplayName(s: { firstName: string; lastName: string | null; displayName: string | null }): string {
  return s.displayName?.trim() || `${s.firstName} ${s.lastName ?? ""}`.trim();
}

export function studentDisplayName(s: { firstName: string; lastName: string | null }): string {
  return `${s.firstName} ${s.lastName ?? ""}`.trim();
}
