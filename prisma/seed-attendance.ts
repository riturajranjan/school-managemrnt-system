// Phase 5 seed — a small, real attendance dataset built on the seeded Class/
// Section/Enrollment (not fake IDs). One SUBMITTED session + one DRAFT session on
// the first section that has enrolled students. Idempotent by (sectionId, date).
import type { PrismaClient } from "../lib/generated/prisma/client";

type Ids = { tenantId: string; schoolId: string; branchId: string; academicSessionId: string };

const SUBMITTED_DATE = new Date("2026-08-10T00:00:00.000Z");
const DRAFT_DATE = new Date("2026-08-11T00:00:00.000Z");
const STATUSES = ["PRESENT", "PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;

export async function seedAttendance(prisma: PrismaClient, ids: Ids) {
  const { tenantId, schoolId, branchId, academicSessionId } = ids;
  const section = await prisma.section.findFirst({
    where: { schoolId, academicSessionId, enrollments: { some: { status: "ENROLLED" } } },
    select: { id: true, branchId: true, enrollments: { where: { status: "ENROLLED" }, select: { id: true, studentId: true } } },
  });
  if (!section) { console.log("  P5:       (no enrolled section — attendance seed skipped)"); return; }

  let created = 0;
  async function upsertSession(date: Date, status: "SUBMITTED" | "DRAFT") {
    const existing = await prisma.attendanceSession.findUnique({ where: { sectionId_date: { sectionId: section!.id, date } }, select: { id: true } });
    if (existing) return;
    await prisma.attendanceSession.create({
      data: {
        tenantId, schoolId, branchId: section!.branchId ?? branchId, academicSessionId, sectionId: section!.id, date, status,
        markedByName: "Class Teacher", submittedAt: status === "SUBMITTED" ? new Date() : null,
        records: { create: section!.enrollments.map((e, i) => ({ studentId: e.studentId, enrollmentId: e.id, status: STATUSES[i % STATUSES.length], markedAt: new Date() })) },
      },
    });
    created++;
  }
  await upsertSession(SUBMITTED_DATE, "SUBMITTED");
  await upsertSession(DRAFT_DATE, "DRAFT");

  const total = await prisma.attendanceSession.count();
  console.log(`  P5:       AttendanceSession=${total} (+${created})`);
}
