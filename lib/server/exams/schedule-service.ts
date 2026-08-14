// Exam subject schedule (Phase 8A) — real, PostgreSQL-backed ExamScheduleEntry.
// A paper may be scheduled only for a Subject actually offered to the target
// Section's Class (reusing getSubjectsForSection — the one curriculum resolver),
// and only once the exam's Class has been assigned (ExamClass). Marks limits are
// SNAPSHOTTED from Subject at creation and never re-read live, so a later Subject
// edit can never rewrite a historical exam's marks configuration. Conflicts:
//   • no duplicate Subject paper for the same exam+section
//   • at most one paper per Section per calendar day (@@unique[sectionId,examDate])
//   • at most one assignment per invigilator per calendar day (optional field)
// All three are DB-enforced (concurrency-safe); a deterministic pre-check gives a
// friendly typed error in the common case, and a race-lost P2002 is re-classified
// by re-querying (the pg driver adapter does not reliably populate meta.target —
// see the Phase 7 timetable service for the same lesson).
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ExamScheduleEntryDto } from "@/lib/api/contracts";
import { getSubjectsForSection } from "@/lib/server/academics/class-subjects-service";
import { dateToUi, parseAttendanceDate as parseExamDate } from "@/lib/server/attendance/service";
import { hhmmToMinutes, minutesToHhmm } from "@/lib/server/timetable/periods-service";
import { scheduleEntryHasRecordedMarks } from "@/lib/server/exams/marks-service";

function requireSession(scope: OrgScope): string {
  if (!scope.academicSessionId) throw new HttpError("INVALID_SESSION", "Select an academic session first");
  return scope.academicSessionId;
}

export const createEntrySchema = z.object({
  sectionId: z.string().min(1), subjectId: z.string().min(1), examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string(), endTime: z.string(),
  maxMarks: z.number().int().min(1).max(1000).optional(), passingMarks: z.number().int().min(0).max(1000).optional(),
  theoryMarks: z.number().int().min(0).max(1000).optional(), practicalMarks: z.number().int().min(0).max(1000).optional(),
  invigilatorStaffId: z.string().min(1).optional(), notes: z.string().trim().max(300).optional(),
});
export const updateEntrySchema = z.object({
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), startTime: z.string().optional(), endTime: z.string().optional(),
  maxMarks: z.number().int().min(1).max(1000).optional(), passingMarks: z.number().int().min(0).max(1000).optional(),
  theoryMarks: z.number().int().min(0).max(1000).optional(), practicalMarks: z.number().int().min(0).max(1000).optional(),
  invigilatorStaffId: z.string().min(1).nullable().optional(), notes: z.string().trim().max(300).nullable().optional(),
});

// ── DTO ──────────────────────────────────────────────────────────────────

const entrySelect = {
  id: true, examId: true, examDate: true, startMinutes: true, endMinutes: true,
  maxMarks: true, passingMarks: true, theoryMarks: true, practicalMarks: true, notes: true,
  section: { select: { id: true, name: true, classId: true, class: { select: { name: true } } } },
  subject: { select: { id: true, code: true, name: true, color: true } },
  invigilator: { select: { id: true, employeeCode: true, firstName: true, lastName: true, displayName: true } },
} satisfies Prisma.ExamScheduleEntrySelect;
type EntryRow = Prisma.ExamScheduleEntryGetPayload<{ select: typeof entrySelect }>;

function entryDto(e: EntryRow): ExamScheduleEntryDto {
  const inv = e.invigilator;
  return {
    id: e.id, examId: e.examId,
    section: { id: e.section.id, name: e.section.name, classId: e.section.classId, className: e.section.class.name },
    subject: { id: e.subject.id, code: e.subject.code, name: e.subject.name, color: e.subject.color },
    examDate: dateToUi(e.examDate), startTime: minutesToHhmm(e.startMinutes), endTime: minutesToHhmm(e.endMinutes),
    maxMarks: e.maxMarks, passingMarks: e.passingMarks, theoryMarks: e.theoryMarks, practicalMarks: e.practicalMarks,
    invigilator: inv ? { id: inv.id, employeeCode: inv.employeeCode, name: inv.displayName?.trim() || `${inv.firstName} ${inv.lastName ?? ""}`.trim() } : null,
    notes: e.notes,
  };
}

// ── Scope guards ───────────────────────────────────────────────────────────

async function requireExamInScope(scope: OrgScope, examId: string): Promise<{ id: string }> {
  const e = await prisma.exam.findFirst({ where: { id: examId, schoolId: scope.schoolId, academicSessionId: requireSession(scope) }, select: { id: true } });
  if (!e) throw new HttpError("EXAM_NOT_FOUND", "Exam not found");
  return e;
}
async function requireSectionInScope(scope: OrgScope, sectionId: string): Promise<{ id: string; branchId: string; classId: string }> {
  const s = await prisma.section.findFirst({
    where: { id: sectionId, schoolId: scope.schoolId, academicSessionId: requireSession(scope), ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select: { id: true, branchId: true, classId: true },
  });
  if (!s) throw new HttpError("NOT_FOUND", "Section not found");
  return s;
}

export async function listSchedule(scope: OrgScope, examId: string): Promise<ExamScheduleEntryDto[]> {
  await requireExamInScope(scope, examId);
  const rows = await prisma.examScheduleEntry.findMany({ where: { examId }, orderBy: [{ examDate: "asc" }, { startMinutes: "asc" }], select: entrySelect });
  return rows.map(entryDto);
}

// ── Conflict pre-check / race classification ──────────────────────────────

async function assertScheduleFree(args: { examId: string; sectionId: string; subjectId: string; examDate: Date; invigilatorStaffId?: string | null }, ignoreId?: string): Promise<void> {
  const ignore = ignoreId ? { id: { not: ignoreId } } : {};
  const [dup, dayTaken, invTaken] = await Promise.all([
    prisma.examScheduleEntry.findFirst({ where: { examId: args.examId, sectionId: args.sectionId, subjectId: args.subjectId, ...ignore }, select: { id: true } }),
    prisma.examScheduleEntry.findFirst({ where: { sectionId: args.sectionId, examDate: args.examDate, ...ignore }, select: { id: true } }),
    args.invigilatorStaffId
      ? prisma.examScheduleEntry.findFirst({ where: { invigilatorStaffId: args.invigilatorStaffId, examDate: args.examDate, ...ignore }, select: { id: true } })
      : Promise.resolve(null),
  ]);
  if (dup) throw new HttpError("DUPLICATE_EXAM_SUBJECT", "This subject is already scheduled for this exam and section");
  if (dayTaken) throw new HttpError("EXAM_SCHEDULE_CONFLICT", "This section already has a paper scheduled on that date");
  if (invTaken) throw new HttpError("INVIGILATOR_CONFLICT", "This invigilator is already assigned to another exam on that date");
}
async function mapRaceConflict(e: unknown, args: Parameters<typeof assertScheduleFree>[0], ignoreId?: string): Promise<never> {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    await assertScheduleFree(args, ignoreId); // re-query classifies which unique fired
    throw new HttpError("EXAM_SCHEDULE_CONFLICT", "This slot was just taken"); // both clear now (rare race) → generic
  }
  throw e;
}

async function requireActiveStaffInScope(scope: OrgScope, staffId: string): Promise<void> {
  const staff = await prisma.staff.findFirst({ where: { id: staffId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (!staff) throw new HttpError("VALIDATION_ERROR", "Invigilator is not a valid, active staff member in this school");
}

// ── Mutations ────────────────────────────────────────────────────────────────

export async function createScheduleEntry(scope: OrgScope, examId: string, raw: unknown): Promise<ExamScheduleEntryDto> {
  const input = parseInput(createEntrySchema, raw);
  await requireExamInScope(scope, examId);
  const section = await requireSectionInScope(scope, input.sectionId);

  // The exam must actually apply to this section's class.
  const examClass = await prisma.examClass.findUnique({ where: { examId_classId: { examId, classId: section.classId } }, select: { id: true } });
  if (!examClass) throw new HttpError("VALIDATION_ERROR", "This exam is not assigned to the section's class");

  // Subject must be offered to the section (real ClassSubject curriculum).
  const offered = await getSubjectsForSection(scope, input.sectionId);
  const subject = offered.find((s) => s.id === input.subjectId);
  if (!subject) throw new HttpError("SUBJECT_NOT_OFFERED", "That subject is not offered by this section's class");

  const startMinutes = hhmmToMinutes(input.startTime);
  const endMinutes = hhmmToMinutes(input.endTime);
  if (startMinutes >= endMinutes) throw new HttpError("INVALID_EXAM_TIME", "The exam must start before it ends");

  if (input.invigilatorStaffId) await requireActiveStaffInScope(scope, input.invigilatorStaffId);

  const examDate = parseExamDate(input.examDate);
  await assertScheduleFree({ examId, sectionId: input.sectionId, subjectId: input.subjectId, examDate, invigilatorStaffId: input.invigilatorStaffId });

  // Snapshot marks from the Subject's current defaults unless explicitly overridden.
  const maxMarks = input.maxMarks ?? subject.maxMarks;
  const passingMarks = input.passingMarks ?? subject.passingMarks;
  const theoryMarks = input.theoryMarks ?? subject.theoryMarks;
  const practicalMarks = input.practicalMarks ?? subject.practicalMarks;

  let created: EntryRow;
  try {
    created = await prisma.$transaction(async (tx) => {
      const row = await tx.examScheduleEntry.create({
        data: {
          tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: section.branchId, academicSessionId: requireSession(scope),
          examId, sectionId: input.sectionId, subjectId: input.subjectId, examDate, startMinutes, endMinutes,
          maxMarks, passingMarks, theoryMarks, practicalMarks, invigilatorStaffId: input.invigilatorStaffId, notes: input.notes,
        },
        select: entrySelect,
      });
      await recordAudit(tx, scope, "EXAM_SCHEDULE_CREATED", "ExamScheduleEntry", row.id, { examId, sectionId: input.sectionId, subjectId: input.subjectId, examDate: input.examDate });
      return row;
    });
  } catch (e) {
    created = (await mapRaceConflict(e, { examId, sectionId: input.sectionId, subjectId: input.subjectId, examDate, invigilatorStaffId: input.invigilatorStaffId })) as never;
  }
  return entryDto(created);
}

async function requireEntryInScope(scope: OrgScope, examId: string, entryId: string) {
  const e = await prisma.examScheduleEntry.findFirst({ where: { id: entryId, examId, schoolId: scope.schoolId, academicSessionId: requireSession(scope) }, select: { id: true, sectionId: true, subjectId: true, examDate: true, invigilatorStaffId: true } });
  if (!e) throw new HttpError("EXAM_SCHEDULE_NOT_FOUND", "Exam schedule entry not found");
  return e;
}

export async function updateScheduleEntry(scope: OrgScope, examId: string, entryId: string, raw: unknown): Promise<ExamScheduleEntryDto> {
  const input = parseInput(updateEntrySchema, raw);
  const current = await requireEntryInScope(scope, examId, entryId);

  let startMinutes: number | undefined, endMinutes: number | undefined;
  if (input.startTime || input.endTime) {
    const existing = await prisma.examScheduleEntry.findUniqueOrThrow({ where: { id: entryId }, select: { startMinutes: true, endMinutes: true } });
    startMinutes = input.startTime ? hhmmToMinutes(input.startTime) : existing.startMinutes;
    endMinutes = input.endTime ? hhmmToMinutes(input.endTime) : existing.endMinutes;
    if (startMinutes >= endMinutes) throw new HttpError("INVALID_EXAM_TIME", "The exam must start before it ends");
  }
  if (input.invigilatorStaffId) await requireActiveStaffInScope(scope, input.invigilatorStaffId);

  const examDate = input.examDate ? parseExamDate(input.examDate) : current.examDate;
  const invigilatorStaffId = input.invigilatorStaffId === undefined ? current.invigilatorStaffId : input.invigilatorStaffId;
  if (input.examDate || input.invigilatorStaffId !== undefined) {
    await assertScheduleFree({ examId, sectionId: current.sectionId, subjectId: current.subjectId, examDate, invigilatorStaffId }, entryId);
  }

  let updated: EntryRow;
  try {
    updated = await prisma.$transaction(async (tx) => {
      const row = await tx.examScheduleEntry.update({
        where: { id: entryId },
        data: {
          examDate: input.examDate ? examDate : undefined, startMinutes, endMinutes,
          maxMarks: input.maxMarks, passingMarks: input.passingMarks, theoryMarks: input.theoryMarks, practicalMarks: input.practicalMarks,
          invigilatorStaffId: input.invigilatorStaffId === undefined ? undefined : input.invigilatorStaffId,
          notes: input.notes === undefined ? undefined : input.notes,
        },
        select: entrySelect,
      });
      await recordAudit(tx, scope, "EXAM_SCHEDULE_UPDATED", "ExamScheduleEntry", entryId);
      return row;
    });
  } catch (e) {
    updated = (await mapRaceConflict(e, { examId, sectionId: current.sectionId, subjectId: current.subjectId, examDate, invigilatorStaffId }, entryId)) as never;
  }
  return entryDto(updated);
}

export async function deleteScheduleEntry(scope: OrgScope, examId: string, entryId: string): Promise<{ id: string }> {
  await requireEntryInScope(scope, examId, entryId);
  // Phase 8B: never let a schedule edit silently destroy recorded marks history.
  if (await scheduleEntryHasRecordedMarks(entryId)) {
    throw new HttpError("CONFLICT", "This paper has recorded marks and cannot be deleted");
  }
  await prisma.$transaction(async (tx) => {
    await tx.examScheduleEntry.delete({ where: { id: entryId } });
    await recordAudit(tx, scope, "EXAM_SCHEDULE_DELETED", "ExamScheduleEntry", entryId, { examId });
  });
  return { id: entryId };
}
