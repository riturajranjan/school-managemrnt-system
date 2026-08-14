// Timetable — teaching-schedule (entry) service + conflict engine (Phase 7).
//
// A TimetableEntry is a lesson: Staff teaches Subject to Section in a Period on a
// Weekday. Every mutation re-validates the full real chain against the caller's
// OrgScope:
//   • Section in scope (→ branch + session derived server-side).
//   • Period in scope AND of type TEACHING (never a BREAK/lunch column).
//   • Subject is offered to the Section (getSubjectsForSection — the one resolver).
//   • A real TeachingAssignment authorises (Section, Subject, Staff) — teaching
//     eligibility is NEVER inferred from staff.isTeaching alone.
//   • Staff is still ACTIVE + teaching-eligible.
// Conflicts are prevented by DATABASE unique constraints (concurrency-safe — a
// race can never double-book): section @@unique[sectionId,weekday,periodId] and
// teacher @@unique[staffId,weekday,periodId]. A P2002 is mapped to a typed
// TIMETABLE_SECTION_CONFLICT / TIMETABLE_TEACHER_CONFLICT (never a raw Prisma leak).
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { SectionTimetableDto, TeacherTimetableDto, TimetableEntryDto, Weekday } from "@/lib/api/contracts";
import { getSubjectsForSection } from "@/lib/server/academics/class-subjects-service";
import { listPeriods, requirePeriodInScope } from "./periods-service";

// The weekdays a timetable grid spans (Mon–Sat; Sunday off). Data, not UI authority.
export const GRID_WEEKDAYS: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const WEEKDAY_TO_DB: Record<Weekday, string> = {
  monday: "MONDAY", tuesday: "TUESDAY", wednesday: "WEDNESDAY", thursday: "THURSDAY", friday: "FRIDAY", saturday: "SATURDAY", sunday: "SUNDAY",
};
const weekdayToUi = (d: string): Weekday => d.toLowerCase() as Weekday;
const weekdayEnum = z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);

export const createEntrySchema = z.object({
  sectionId: z.string().min(1), subjectId: z.string().min(1), staffId: z.string().min(1),
  periodId: z.string().min(1), weekday: weekdayEnum, notes: z.string().trim().max(200).optional(),
});
export const updateEntrySchema = z.object({
  periodId: z.string().min(1).optional(), weekday: weekdayEnum.optional(), notes: z.string().trim().max(200).nullable().optional(),
});

// ── DTO ──────────────────────────────────────────────────────────────────

const entrySelect = {
  id: true, weekday: true, periodId: true, teachingAssignmentId: true, notes: true,
  section: { select: { id: true, name: true, classId: true, class: { select: { name: true } } } },
  subject: { select: { id: true, code: true, name: true, color: true } },
  staff: { select: { id: true, employeeCode: true, firstName: true, lastName: true, displayName: true } },
} satisfies Prisma.TimetableEntrySelect;
type EntryRow = Prisma.TimetableEntryGetPayload<{ select: typeof entrySelect }>;

function entryDto(e: EntryRow): TimetableEntryDto {
  const staffName = e.staff.displayName?.trim() || `${e.staff.firstName} ${e.staff.lastName ?? ""}`.trim();
  return {
    id: e.id, weekday: weekdayToUi(e.weekday), periodId: e.periodId,
    section: { id: e.section.id, name: e.section.name, classId: e.section.classId, className: e.section.class.name },
    subject: { id: e.subject.id, code: e.subject.code, name: e.subject.name, color: e.subject.color },
    staff: { id: e.staff.id, employeeCode: e.staff.employeeCode, name: staffName },
    teachingAssignmentId: e.teachingAssignmentId, notes: e.notes,
  };
}

// ── Scope guards ───────────────────────────────────────────────────────────

function requireSession(scope: OrgScope): string {
  if (!scope.academicSessionId) throw new HttpError("INVALID_SESSION", "Select an academic session first");
  return scope.academicSessionId;
}
async function requireSectionInScope(scope: OrgScope, sectionId: string) {
  const s = await prisma.section.findFirst({
    where: { id: sectionId, schoolId: scope.schoolId, academicSessionId: requireSession(scope), ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select: { id: true, name: true, branchId: true, academicSessionId: true, classId: true, class: { select: { name: true } } },
  });
  if (!s) throw new HttpError("NOT_FOUND", "Section not found");
  return s;
}

// ── Reads ──────────────────────────────────────────────────────────────────

const entryOrder: Prisma.TimetableEntryOrderByWithRelationInput[] = [{ weekday: "asc" }, { period: { order: "asc" } }];

export async function getSectionTimetable(scope: OrgScope, sectionId: string): Promise<SectionTimetableDto> {
  const section = await requireSectionInScope(scope, sectionId);
  const [periods, rows] = await Promise.all([
    listPeriods(scope),
    prisma.timetableEntry.findMany({ where: { sectionId }, orderBy: entryOrder, select: entrySelect }),
  ]);
  return {
    section: { id: section.id, name: section.name, classId: section.classId, className: section.class.name },
    weekdays: GRID_WEEKDAYS, periods, entries: rows.map(entryDto),
  };
}

export async function getTeacherTimetable(scope: OrgScope, staffId: string): Promise<TeacherTimetableDto> {
  const staff = await prisma.staff.findFirst({
    where: { id: staffId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select: { id: true, employeeCode: true, firstName: true, lastName: true, displayName: true },
  });
  if (!staff) throw new HttpError("NOT_FOUND", "Staff member not found");
  const [periods, rows] = await Promise.all([
    listPeriods(scope),
    prisma.timetableEntry.findMany({ where: { staffId, academicSessionId: requireSession(scope) }, orderBy: entryOrder, select: entrySelect }),
  ]);
  const name = staff.displayName?.trim() || `${staff.firstName} ${staff.lastName ?? ""}`.trim();
  return { staff: { id: staff.id, employeeCode: staff.employeeCode, name }, weekdays: GRID_WEEKDAYS, periods, entries: rows.map(entryDto) };
}

// ── Mutations ────────────────────────────────────────────────────────────────

/**
 * Classify a slot conflict by inspecting the real rows occupying (weekday, period)
 * — used both for a deterministic pre-check (friendly error before insert) and to
 * map a race-lost P2002 (the pg driver adapter does not reliably populate
 * meta.target, so we re-query rather than parse the constraint name). `ignoreId`
 * lets an update skip the row being moved. Throws the typed conflict, or returns.
 */
async function assertSlotFree(
  where: { sectionId: string; staffId: string; weekday: string; periodId: string },
  ignoreId?: string,
): Promise<void> {
  const base = { weekday: where.weekday as never, periodId: where.periodId, ...(ignoreId ? { id: { not: ignoreId } } : {}) };
  const [sectionTaken, teacherTaken] = await Promise.all([
    prisma.timetableEntry.findFirst({ where: { ...base, sectionId: where.sectionId }, select: { id: true } }),
    prisma.timetableEntry.findFirst({ where: { ...base, staffId: where.staffId }, select: { id: true } }),
  ]);
  if (sectionTaken) throw new HttpError("TIMETABLE_SECTION_CONFLICT", "This section already has a lesson in that period");
  if (teacherTaken) throw new HttpError("TIMETABLE_TEACHER_CONFLICT", "This teacher is already scheduled for that period");
}

/** Map a P2002 raised by the DB uniques (race path) to a typed conflict. */
async function mapRaceConflict(e: unknown, slot: { sectionId: string; staffId: string; weekday: string; periodId: string }, ignoreId?: string): Promise<never> {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    await assertSlotFree(slot, ignoreId); // re-query classifies which unique fired
    throw new HttpError("TIMETABLE_SECTION_CONFLICT", "This slot is already taken"); // both free now (rare) → generic
  }
  throw e;
}

async function requireTeachingAssignment(scope: OrgScope, sectionId: string, subjectId: string, staffId: string): Promise<string> {
  const ta = await prisma.teachingAssignment.findFirst({
    where: { sectionId, subjectId, staffId, schoolId: scope.schoolId },
    select: { id: true, staff: { select: { status: true, isTeaching: true } } },
  });
  if (!ta) throw new HttpError("TEACHER_NOT_ASSIGNED", "This teacher is not assigned to teach that subject in this section");
  if (ta.staff.status !== "ACTIVE" || !ta.staff.isTeaching) throw new HttpError("TEACHER_NOT_ASSIGNED", "That teacher is not an active teaching staff member");
  return ta.id;
}

export async function createEntry(scope: OrgScope, raw: unknown): Promise<TimetableEntryDto> {
  const input = parseInput(createEntrySchema, raw);
  const section = await requireSectionInScope(scope, input.sectionId);
  const period = await requirePeriodInScope(scope, input.periodId);
  if (period.type !== "TEACHING") throw new HttpError("INVALID_TIMETABLE_PERIOD", "Lessons cannot be scheduled in a break/lunch period");
  if (period.branchId !== section.branchId) throw new HttpError("INVALID_TIMETABLE_PERIOD", "That period belongs to a different branch");

  const offered = await getSubjectsForSection(scope, input.sectionId);
  if (!offered.some((s) => s.id === input.subjectId)) throw new HttpError("SUBJECT_NOT_OFFERED", "That subject is not offered by this section's class");

  const teachingAssignmentId = await requireTeachingAssignment(scope, input.sectionId, input.subjectId, input.staffId);

  const dbWeekday = WEEKDAY_TO_DB[input.weekday];
  const slot = { sectionId: input.sectionId, staffId: input.staffId, weekday: dbWeekday, periodId: input.periodId };
  await assertSlotFree(slot); // deterministic friendly error (DB unique still guards the race)

  let created: EntryRow;
  try {
    created = await prisma.$transaction(async (tx) => {
      const row = await tx.timetableEntry.create({
        data: {
          tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: section.branchId, academicSessionId: section.academicSessionId,
          sectionId: input.sectionId, subjectId: input.subjectId, staffId: input.staffId, teachingAssignmentId,
          periodId: input.periodId, weekday: dbWeekday as never, notes: input.notes,
        },
        select: entrySelect,
      });
      await recordAudit(tx, scope, "TIMETABLE_ENTRY_CREATED", "TimetableEntry", row.id, { sectionId: input.sectionId, subjectId: input.subjectId, staffId: input.staffId, weekday: input.weekday });
      return row;
    });
  } catch (e) {
    await mapRaceConflict(e, slot);
  }
  return entryDto(created!);
}

async function requireEntryInScope(scope: OrgScope, entryId: string) {
  const e = await prisma.timetableEntry.findFirst({
    where: { id: entryId, schoolId: scope.schoolId, academicSessionId: requireSession(scope), ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select: { id: true, sectionId: true, staffId: true, weekday: true, periodId: true },
  });
  if (!e) throw new HttpError("TIMETABLE_ENTRY_NOT_FOUND", "Timetable entry not found");
  return e;
}

export async function updateEntry(scope: OrgScope, entryId: string, raw: unknown): Promise<TimetableEntryDto> {
  const input = parseInput(updateEntrySchema, raw);
  const current = await requireEntryInScope(scope, entryId);
  if (input.periodId) {
    const period = await requirePeriodInScope(scope, input.periodId);
    if (period.type !== "TEACHING") throw new HttpError("INVALID_TIMETABLE_PERIOD", "Lessons cannot be scheduled in a break/lunch period");
  }
  // Re-check the destination slot (period/weekday may change; section+staff stay).
  const slot = {
    sectionId: current.sectionId, staffId: current.staffId,
    weekday: input.weekday ? WEEKDAY_TO_DB[input.weekday] : current.weekday,
    periodId: input.periodId ?? current.periodId,
  };
  if (input.periodId || input.weekday) await assertSlotFree(slot, entryId);

  let updated: EntryRow;
  try {
    updated = await prisma.$transaction(async (tx) => {
      const row = await tx.timetableEntry.update({
        where: { id: entryId },
        data: { periodId: input.periodId, weekday: input.weekday ? (WEEKDAY_TO_DB[input.weekday] as never) : undefined, notes: input.notes === undefined ? undefined : input.notes },
        select: entrySelect,
      });
      await recordAudit(tx, scope, "TIMETABLE_ENTRY_UPDATED", "TimetableEntry", entryId);
      return row;
    });
  } catch (e) {
    await mapRaceConflict(e, slot, entryId);
  }
  return entryDto(updated!);
}

export async function deleteEntry(scope: OrgScope, entryId: string): Promise<{ id: string }> {
  await requireEntryInScope(scope, entryId);
  await prisma.$transaction(async (tx) => {
    await tx.timetableEntry.delete({ where: { id: entryId } });
    await recordAudit(tx, scope, "TIMETABLE_ENTRY_DELETED", "TimetableEntry", entryId);
  });
  return { id: entryId };
}
