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
    const existing = await prisma.attendanceSession.findFirst({ where: { sectionId: section!.id, date, type: "DAILY" }, select: { id: true } });
    if (existing) return;
    await prisma.attendanceSession.create({
      data: {
        tenantId, schoolId, branchId: section!.branchId ?? branchId, academicSessionId, sectionId: section!.id, date, type: "DAILY", status,
        markedByName: "Class Teacher", submittedAt: status === "SUBMITTED" ? new Date() : null,
        records: { create: section!.enrollments.map((e, i) => ({ studentId: e.studentId, enrollmentId: e.id, status: STATUSES[i % STATUSES.length], markedAt: new Date() })) },
      },
    });
    created++;
  }
  await upsertSession(SUBMITTED_DATE, "SUBMITTED");
  await upsertSession(DRAFT_DATE, "DRAFT");

  // Phase 7C — one PERIOD session on a real timetable lesson, dated to that lesson's
  // weekday. Idempotent by the partial-unique (timetableEntryId, date).
  const DAY_INDEX: Record<string, number> = { SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6 };
  let periodCreated = 0;
  const entry = await prisma.timetableEntry.findFirst({
    where: { schoolId, academicSessionId },
    select: {
      id: true, sectionId: true, branchId: true, weekday: true, staffId: true,
      period: { select: { id: true, name: true } }, subject: { select: { id: true, code: true, name: true } },
      staff: { select: { firstName: true, lastName: true, displayName: true } },
      section: { select: { enrollments: { where: { status: "ENROLLED" }, select: { id: true, studentId: true } } } },
    },
  });
  if (entry && entry.section.enrollments.length) {
    // First date >= 2026-08-03 whose UTC weekday matches the lesson.
    const d = new Date("2026-08-03T00:00:00.000Z");
    for (let i = 0; i < 7 && d.getUTCDay() !== DAY_INDEX[entry.weekday]; i++) d.setUTCDate(d.getUTCDate() + 1);
    const existing = await prisma.attendanceSession.findFirst({ where: { type: "PERIOD", timetableEntryId: entry.id, date: d }, select: { id: true } });
    if (!existing) {
      const staffName = entry.staff.displayName?.trim() || `${entry.staff.firstName} ${entry.staff.lastName ?? ""}`.trim();
      await prisma.attendanceSession.create({
        data: {
          tenantId, schoolId, branchId: entry.branchId, academicSessionId, sectionId: entry.sectionId, date: d, type: "PERIOD", status: "SUBMITTED",
          timetableEntryId: entry.id, periodId: entry.period.id, periodName: entry.period.name,
          subjectId: entry.subject.id, subjectCode: entry.subject.code, subjectName: entry.subject.name,
          staffId: entry.staffId, staffName, markedByName: staffName, submittedAt: new Date(),
          records: { create: entry.section.enrollments.map((e, i) => ({ studentId: e.studentId, enrollmentId: e.id, status: STATUSES[i % STATUSES.length], markedAt: new Date() })) },
        },
      });
      periodCreated++;
    }
  }

  const total = await prisma.attendanceSession.count();
  console.log(`  P5/7C:    AttendanceSession=${total} (+${created} daily, +${periodCreated} period)`);
}
