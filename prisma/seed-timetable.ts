// Phase 7 seed — a real bell schedule + a small week of timetable entries built on
// real Sections + TeachingAssignments (never fabricated ids). Idempotent: periods
// keyed by (branch, session, periodNumber); entries by the DB conflict uniques.
import type { PrismaClient } from "../lib/generated/prisma/client";

type Ids = { tenantId: string; schoolId: string; branchId: string; academicSessionId: string };

const hhmm = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };

const PERIODS = [
  { name: "Period 1", periodNumber: 1, start: "08:00", end: "08:45", type: "TEACHING" as const },
  { name: "Period 2", periodNumber: 2, start: "08:45", end: "09:30", type: "TEACHING" as const },
  { name: "Period 3", periodNumber: 3, start: "09:30", end: "10:15", type: "TEACHING" as const },
  { name: "Short break", periodNumber: 4, start: "10:15", end: "10:30", type: "BREAK" as const },
  { name: "Period 4", periodNumber: 5, start: "10:30", end: "11:15", type: "TEACHING" as const },
  { name: "Period 5", periodNumber: 6, start: "11:15", end: "12:00", type: "TEACHING" as const },
  { name: "Lunch", periodNumber: 7, start: "12:00", end: "12:40", type: "BREAK" as const },
  { name: "Period 6", periodNumber: 8, start: "12:40", end: "13:25", type: "TEACHING" as const },
];

const WEEKDAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const;

export async function seedTimetable(prisma: PrismaClient, ids: Ids) {
  const { tenantId, schoolId, branchId, academicSessionId } = ids;

  // 1) Bell schedule (idempotent by periodNumber).
  const periodByNumber = new Map<number, { id: string; type: string }>();
  let periodsCreated = 0;
  for (let i = 0; i < PERIODS.length; i++) {
    const p = PERIODS[i];
    const existing = await prisma.timetablePeriod.findFirst({ where: { schoolId, branchId, academicSessionId, periodNumber: p.periodNumber }, select: { id: true, type: true } });
    const row = existing ?? (await prisma.timetablePeriod.create({
      data: { tenantId, schoolId, branchId, academicSessionId, name: p.name, periodNumber: p.periodNumber, startMinutes: hhmm(p.start), endMinutes: hhmm(p.end), type: p.type, order: i },
      select: { id: true, type: true },
    }));
    if (!existing) periodsCreated++;
    periodByNumber.set(p.periodNumber, row);
  }
  const teachingPeriods = PERIODS.filter((p) => p.type === "TEACHING").map((p) => periodByNumber.get(p.periodNumber)!);

  // 2) A small week of entries from real TeachingAssignments on one section.
  const assignment = await prisma.teachingAssignment.findFirst({ where: { schoolId, academicSessionId }, select: { sectionId: true } });
  let entriesCreated = 0;
  if (assignment) {
    const assignments = await prisma.teachingAssignment.findMany({
      where: { sectionId: assignment.sectionId },
      select: { id: true, sectionId: true, subjectId: true, staffId: true, branchId: true },
    });
    // Place each assignment on Monday across the first teaching periods, then spill to Tuesday.
    let idx = 0;
    for (const a of assignments) {
      const period = teachingPeriods[idx % teachingPeriods.length];
      const weekday = WEEKDAYS[Math.floor(idx / teachingPeriods.length) % WEEKDAYS.length];
      idx++;
      const clash = await prisma.timetableEntry.findFirst({ where: { sectionId: a.sectionId, weekday, periodId: period.id }, select: { id: true } });
      if (clash) continue;
      // teacher-conflict guard (seed is single-branch, but stay safe)
      const teacherClash = await prisma.timetableEntry.findFirst({ where: { staffId: a.staffId, weekday, periodId: period.id }, select: { id: true } });
      if (teacherClash) continue;
      await prisma.timetableEntry.create({
        data: { tenantId, schoolId, branchId: a.branchId, academicSessionId, sectionId: a.sectionId, subjectId: a.subjectId, staffId: a.staffId, teachingAssignmentId: a.id, periodId: period.id, weekday },
      });
      entriesCreated++;
    }
  }

  console.log(`  P7:       ${periodsCreated} periods created (${PERIODS.length} total), ${entriesCreated} timetable entries`);
}
