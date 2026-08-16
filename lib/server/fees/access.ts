// Shared broad-manager check for Fees (Phase 9F) — gates category/structure/
// assignment/discount/scholarship/late-fee/reconciliation mutations, matching
// the fees.manage permission's grant (SCHOOL_ADMIN only in the current
// catalog; PRINCIPAL is oversight/view-only). Payment recording and refunds
// have their own route-level fees.collect/fees.refund gates instead.
import { prisma } from "@/lib/db/prisma";
import type { OrgScope } from "@/lib/server/api/scope";

const FEE_MANAGER_ROLE_KEYS = ["SCHOOL_ADMIN"];

export async function isBroadFeeManager(scope: OrgScope): Promise<boolean> {
  const m = await prisma.roleAssignment.findFirst({
    where: { membership: { userId: scope.actor.id, tenantId: scope.tenantId, status: "ACTIVE" }, role: { key: { in: FEE_MANAGER_ROLE_KEYS } } },
    select: { id: true },
  });
  return Boolean(m);
}
