// Phase 9E seed — real StaffAttendanceRecord (a handful of recent days across
// the seeded teaching staff) + one real LeaveType with a PENDING and an
// APPROVED LeaveRequest (the latter with its real ON_LEAVE write-through onto
// StaffAttendanceRecord), so the demo has something real to walk through.
// Idempotent (upsert on staffId+date; skip-if-exists on type code / request
// reason+staffId).
import type { PrismaClient } from "../lib/generated/prisma/client";

type Ids = { tenantId: string; schoolId: string; branchId: string; academicSessionId: string };

export async function seedStaffAttendanceLeave(prisma: PrismaClient, ids: Ids) {
  const { tenantId, schoolId, branchId } = ids;

  const staffRows = await prisma.staff.findMany({ where: { schoolId, status: "ACTIVE" }, orderBy: { employeeCode: "asc" }, select: { id: true, userId: true } });
  const admin = await prisma.roleAssignment.findFirst({
    where: { role: { key: "SCHOOL_ADMIN" }, membership: { tenantId, status: "ACTIVE" } },
    select: { membership: { select: { userId: true } } },
  });
  if (staffRows.length === 0 || !admin) {
    console.log("  P9E:      skipped (no real ACTIVE staff or SCHOOL_ADMIN yet)");
    return;
  }
  const adminUserId = admin.membership.userId;

  // A handful of recent-day attendance rows across the roster.
  const STATUSES: ("PRESENT" | "LATE" | "ABSENT" | "HALF_DAY")[] = ["PRESENT", "PRESENT", "LATE", "ABSENT", "HALF_DAY"];
  let attendanceCreated = 0;
  for (let dayOffset = 1; dayOffset <= 5; dayOffset++) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - dayOffset);
    date.setUTCHours(0, 0, 0, 0);
    if (date.getUTCDay() === 0) continue; // Sunday off
    for (const [i, staff] of staffRows.entries()) {
      const status = STATUSES[(dayOffset + i) % STATUSES.length];
      const existing = await prisma.staffAttendanceRecord.findUnique({ where: { staffId_date: { staffId: staff.id, date } }, select: { id: true } });
      if (existing) continue;
      await prisma.staffAttendanceRecord.create({
        data: {
          tenantId, schoolId, branchId, staffId: staff.id, date, status,
          checkInAt: status === "PRESENT" || status === "LATE" ? new Date(date.getTime() + 8 * 3_600_000) : null,
          checkOutAt: status === "PRESENT" ? new Date(date.getTime() + 15.5 * 3_600_000) : null,
          markedByUserId: adminUserId, markedByName: "School Admin",
        },
      });
      attendanceCreated++;
    }
  }

  // One real LeaveType.
  let leaveType = await prisma.leaveType.findFirst({ where: { schoolId, code: "CL" }, select: { id: true } });
  if (!leaveType) {
    leaveType = await prisma.leaveType.create({ data: { tenantId, schoolId, name: "Casual Leave", code: "CL", isPaid: true }, select: { id: true } });
  }

  const requester = staffRows.find((s) => s.userId) ?? staffRows[0];
  let leaveCreated = 0;

  const pendingExists = await prisma.leaveRequest.findFirst({ where: { staffId: requester.id, reason: "Family function next week" }, select: { id: true } });
  if (!pendingExists) {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 10);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    await prisma.leaveRequest.create({
      data: { tenantId, schoolId, branchId, staffId: requester.id, leaveTypeId: leaveType.id, startDate: start, endDate: end, reason: "Family function next week", requestedByUserId: requester.userId ?? adminUserId },
    });
    leaveCreated++;
  }

  const secondRequester = staffRows.find((s) => s.id !== requester.id) ?? requester;
  const approvedExists = await prisma.leaveRequest.findFirst({ where: { staffId: secondRequester.id, reason: "Medical appointment (past)" }, select: { id: true } });
  if (!approvedExists) {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 3);
    start.setUTCHours(0, 0, 0, 0);
    await prisma.leaveRequest.create({
      data: {
        tenantId, schoolId, branchId, staffId: secondRequester.id, leaveTypeId: leaveType.id, startDate: start, endDate: start,
        reason: "Medical appointment (past)", requestedByUserId: secondRequester.userId ?? adminUserId,
        status: "APPROVED", reviewedByUserId: adminUserId, reviewedByName: "School Admin", reviewedAt: new Date(),
      },
    });
    await prisma.staffAttendanceRecord.upsert({
      where: { staffId_date: { staffId: secondRequester.id, date: start } },
      create: { tenantId, schoolId, branchId, staffId: secondRequester.id, date: start, status: "ON_LEAVE", markedByUserId: adminUserId, markedByName: "School Admin" },
      update: { status: "ON_LEAVE" },
    });
    leaveCreated++;
  }

  console.log(`  P9E:      staffAttendance(+${attendanceCreated}) leaveRequests(+${leaveCreated})`);
}
