// Phase 9I seed — one real walk-in visitor (checked in) and one real
// expected visitor, both hosted by a real seeded teaching Staff member, so
// the Front Desk demo has something real to show. Idempotent (checks by
// phone before creating).
import type { PrismaClient } from "../lib/generated/prisma/client";
import { createExpectedVisit, createWalkInVisit } from "../lib/server/visitors/visits";
import type { OrgScope } from "../lib/server/api/scope";

type Ids = { tenantId: string; schoolId: string; branchId: string; academicSessionId: string };

const WALK_IN_PHONE = "9820000001";
const EXPECTED_PHONE = "9820000002";

export async function seedVisitors(prisma: PrismaClient, ids: Ids) {
  const { tenantId, schoolId, branchId, academicSessionId } = ids;

  const admin = await prisma.roleAssignment.findFirst({
    where: { role: { key: "SCHOOL_ADMIN" }, membership: { tenantId, status: "ACTIVE" } },
    select: { membership: { select: { userId: true } } },
  });
  const host = await prisma.staff.findFirst({ where: { schoolId, employeeCode: "TCH-001" }, select: { id: true } });
  if (!admin || !host) {
    console.log("  P9I:      skipped (no real SCHOOL_ADMIN or seeded Staff yet)");
    return;
  }
  const scope: OrgScope = { tenantId, schoolId, branchId, academicSessionId, actor: { id: admin.membership.userId, name: "School Admin" } };

  let walkIns = 0, expected = 0;
  const existingWalkIn = await prisma.visitor.findFirst({ where: { schoolId, phone: WALK_IN_PHONE }, select: { id: true } });
  if (!existingWalkIn) {
    await createWalkInVisit(scope, { fullName: "Deepak Sharma", phone: WALK_IN_PHONE, category: "parent", purpose: "Meet class teacher", department: "Academics", hostStaffId: host.id });
    walkIns = 1;
  }
  const existingExpected = await prisma.visitor.findFirst({ where: { schoolId, phone: EXPECTED_PHONE }, select: { id: true } });
  if (!existingExpected) {
    const tomorrow = new Date(); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1); tomorrow.setUTCHours(10, 30, 0, 0);
    await createExpectedVisit(scope, { fullName: "Priya Enterprises", phone: EXPECTED_PHONE, category: "vendor", purpose: "Stationery supply meeting", department: "Administration", hostStaffId: host.id, expectedAt: tomorrow.toISOString() });
    expected = 1;
  }

  console.log(`  P9I:      walk-in visits(+${walkIns}) expected visits(+${expected})`);
}
