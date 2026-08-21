// Marks entry (Phase 8B) — real, PostgreSQL-backed ExamMarkSheet / ExamMark on
// top of the Phase 8A ExamScheduleEntry. One ExamMarkSheet per schedule entry
// (get-or-create, race-safe via the unique FK) owns a small Draft → Submitted →
// Verified lifecycle; ExamMark rows carry no submission state of their own.
//
// Authority chain, all server-validated (never trusted from the browser):
//   ExamScheduleEntry → Section → Enrollment(ENROLLED) → Student   (who may be marked)
//   ExamScheduleEntry.{maxMarks,passingMarks,theoryMarks,practicalMarks}  (marks caps —
//     the Phase 8A snapshot, never live Subject data)
//   User → Staff.userId → TeachingAssignment(sectionId, subjectId)  (who may enter, unless
//     the actor holds a broad role — SCHOOL_ADMIN/PRINCIPAL — which bypasses ownership)
//
// Status is explicit and never conflated with a numeric value: ABSENT and EXEMPT
// always carry null marks; a numeric 0 is a real, valid score and is preserved as
// such. Marks are plain integers (matching Subject/ExamScheduleEntry's existing
// Int convention throughout this codebase) — no decimal precision is introduced.
//
// Reopening a VERIFIED sheet is deliberately NOT implemented in this phase (no
// clear policy/permission boundary exists yet) — attempts fail closed with
// MARKS_LOCKED. Results/Grades/Rank/Report Cards are out of scope; this module
// only ever reads the schedule snapshot for validation, never computes a result.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ExamMarkSheetStatus, ExamMarkStatus, ExamMarksRosterDto, ExamMarksRosterStudentDto, ExamMarksSummaryItemDto } from "@/lib/api/contracts";
import { dateToUi } from "@/lib/server/attendance/service";
import { minutesToHhmm } from "@/lib/server/timetable/periods-service";

function requireSession(scope: OrgScope): string {
  if (!scope.academicSessionId) throw new HttpError("INVALID_SESSION", "Select an academic session first");
  return scope.academicSessionId;
}

// ── Scope guards ─────────────────────────────────────────────────────────────

async function requireExamInScope(scope: OrgScope, examId: string): Promise<{ id: string }> {
  const e = await prisma.exam.findFirst({ where: { id: examId, schoolId: scope.schoolId, academicSessionId: requireSession(scope) }, select: { id: true } });
  if (!e) throw new HttpError("EXAM_NOT_FOUND", "Exam not found");
  return e;
}

const entryWithContextSelect = {
  id: true, examId: true, sectionId: true, subjectId: true,
  examDate: true, startMinutes: true, endMinutes: true,
  maxMarks: true, passingMarks: true, theoryMarks: true, practicalMarks: true,
  section: { select: { id: true, name: true, classId: true, class: { select: { name: true } } } },
  subject: { select: { id: true, code: true, name: true, color: true } },
} satisfies Prisma.ExamScheduleEntrySelect;
type EntryWithContext = Prisma.ExamScheduleEntryGetPayload<{ select: typeof entryWithContextSelect }>;

async function requireEntryInScope(scope: OrgScope, examId: string, entryId: string): Promise<EntryWithContext> {
  const e = await prisma.examScheduleEntry.findFirst({
    where: { id: entryId, examId, schoolId: scope.schoolId, academicSessionId: requireSession(scope) },
    select: entryWithContextSelect,
  });
  if (!e) throw new HttpError("EXAM_SCHEDULE_NOT_FOUND", "Exam schedule entry not found");
  return e;
}

// ── Authorization ────────────────────────────────────────────────────────────

/** SCHOOL_ADMIN/PRINCIPAL hold marks.verify and may enter/verify for any section+subject. */
export async function isBroadMarksManager(scope: OrgScope): Promise<boolean> {
  const m = await prisma.roleAssignment.findFirst({
    where: { membership: { userId: scope.actor.id, tenantId: scope.tenantId, status: "ACTIVE" }, role: { key: { in: ["SCHOOL_ADMIN", "PRINCIPAL"] } } },
    select: { id: true },
  });
  return Boolean(m);
}

/** True if the actor may enter marks for this entry's section+subject: a broad
 *  manager, or a teacher with a real TeachingAssignment there. Mirrors the
 *  Period Attendance teacher-ownership pattern (lib/server/attendance/service.ts). */
async function canActorEnterMarks(scope: OrgScope, entry: { sectionId: string; subjectId: string }): Promise<boolean> {
  if (await isBroadMarksManager(scope)) return true;
  const staff = await prisma.staff.findFirst({ where: { userId: scope.actor.id, schoolId: scope.schoolId }, select: { id: true } });
  if (!staff) return false;
  const ta = await prisma.teachingAssignment.findFirst({ where: { sectionId: entry.sectionId, subjectId: entry.subjectId, staffId: staff.id }, select: { id: true } });
  return Boolean(ta);
}

async function assertCanEnterMarks(scope: OrgScope, entry: { sectionId: string; subjectId: string }): Promise<void> {
  if (!(await canActorEnterMarks(scope, entry))) throw new HttpError("TEACHER_NOT_ASSIGNED", "You are not assigned to teach this subject in this section");
}

/** Mutation gate that also accounts for the sheet's lifecycle: VERIFIED is
 *  always locked; SUBMITTED blocks ordinary teacher edits but a broad manager
 *  may still correct it before verifying. */
async function assertCanMutateMarks(scope: OrgScope, entry: { sectionId: string; subjectId: string }, sheetStatus: string): Promise<void> {
  if (sheetStatus === "VERIFIED") throw new HttpError("MARKS_LOCKED", "Marks have been verified and are locked");
  const broad = await isBroadMarksManager(scope);
  if (broad) return;
  if (sheetStatus === "SUBMITTED") throw new HttpError("MARKS_ALREADY_SUBMITTED", "Marks have been submitted and can no longer be edited");
  await assertCanEnterMarks(scope, entry);
}

// ── Get-or-create sheet (race-safe via the unique FK) ────────────────────────

async function getOrCreateMarkSheet(scope: OrgScope, entry: { id: string }) {
  const existing = await prisma.examMarkSheet.findUnique({ where: { examScheduleEntryId: entry.id } });
  if (existing) return existing;
  try {
    return await prisma.examMarkSheet.create({
      data: { tenantId: scope.tenantId, schoolId: scope.schoolId, academicSessionId: requireSession(scope), examScheduleEntryId: entry.id, status: "DRAFT" },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return await prisma.examMarkSheet.findUniqueOrThrow({ where: { examScheduleEntryId: entry.id } });
    }
    throw e;
  }
}

// ── DTO assembly ─────────────────────────────────────────────────────────────

const SHEET_STATUS_TO_UI: Record<string, ExamMarkSheetStatus> = { DRAFT: "draft", SUBMITTED: "submitted", VERIFIED: "verified" };
const MARK_STATUS_TO_UI: Record<string, ExamMarkStatus> = { PENDING: "pending", MARKED: "marked", ABSENT: "absent", EXEMPT: "exempt" };
const MARK_STATUS_TO_DB: Record<ExamMarkStatus, string> = { pending: "PENDING", marked: "MARKED", absent: "ABSENT", exempt: "EXEMPT" };

export async function getMarksRoster(scope: OrgScope, examId: string, entryId: string): Promise<ExamMarksRosterDto> {
  await requireExamInScope(scope, examId);
  const entry = await requireEntryInScope(scope, examId, entryId);
  const sheet = await getOrCreateMarkSheet(scope, entry);

  const [eligible, existingMarks, canEnter, canVerify] = await Promise.all([
    prisma.enrollment.findMany({
      where: { sectionId: entry.sectionId, status: "ENROLLED" },
      select: { id: true, studentId: true, rollNumber: true, student: { select: { admissionNumber: true, rollNumber: true, firstName: true, lastName: true } } },
    }),
    prisma.examMark.findMany({
      where: { markSheetId: sheet.id },
      select: {
        studentId: true, enrollmentId: true, status: true, theoryMarks: true, practicalMarks: true, marksObtained: true, remarks: true, enteredByName: true, enteredAt: true,
        student: { select: { admissionNumber: true, rollNumber: true, firstName: true, lastName: true } },
      },
    }),
    canActorEnterMarks(scope, entry),
    isBroadMarksManager(scope),
  ]);

  const byStudent = new Map<string, ExamMarksRosterStudentDto>();
  for (const en of eligible) {
    byStudent.set(en.studentId, {
      studentId: en.studentId, enrollmentId: en.id, admissionNumber: en.student.admissionNumber, rollNumber: en.rollNumber ?? en.student.rollNumber,
      name: `${en.student.firstName} ${en.student.lastName}`.trim(), currentlyEnrolled: true,
      status: "pending", theoryMarks: null, practicalMarks: null, marksObtained: null, remarks: null, enteredByName: null, enteredAt: null,
    });
  }
  for (const m of existingMarks) {
    const base = byStudent.get(m.studentId);
    byStudent.set(m.studentId, {
      studentId: m.studentId, enrollmentId: m.enrollmentId, admissionNumber: m.student.admissionNumber, rollNumber: base?.rollNumber ?? m.student.rollNumber,
      name: base?.name ?? `${m.student.firstName} ${m.student.lastName}`.trim(), currentlyEnrolled: Boolean(base),
      status: MARK_STATUS_TO_UI[m.status], theoryMarks: m.theoryMarks, practicalMarks: m.practicalMarks, marksObtained: m.marksObtained,
      remarks: m.remarks, enteredByName: m.enteredByName, enteredAt: m.enteredAt?.toISOString() ?? null,
    });
  }
  const students = [...byStudent.values()].sort((a, b) => {
    const r = (a.rollNumber ?? "").localeCompare(b.rollNumber ?? "", undefined, { numeric: true });
    return r !== 0 ? r : a.name.localeCompare(b.name);
  });

  const summary = {
    totalStudents: students.length,
    enteredCount: students.filter((s) => s.status !== "pending").length,
    pendingCount: students.filter((s) => s.status === "pending").length,
    absentCount: students.filter((s) => s.status === "absent").length,
    exemptCount: students.filter((s) => s.status === "exempt").length,
  };

  return {
    examId,
    entry: {
      id: entry.id, examDate: dateToUi(entry.examDate), startTime: minutesToHhmm(entry.startMinutes), endTime: minutesToHhmm(entry.endMinutes),
      section: { id: entry.section.id, name: entry.section.name, classId: entry.section.classId, className: entry.section.class.name },
      subject: { id: entry.subject.id, code: entry.subject.code, name: entry.subject.name, color: entry.subject.color },
      maxMarks: entry.maxMarks, passingMarks: entry.passingMarks, theoryMarks: entry.theoryMarks, practicalMarks: entry.practicalMarks,
    },
    sheet: {
      id: sheet.id, status: SHEET_STATUS_TO_UI[sheet.status], submittedByName: sheet.submittedByName, submittedAt: sheet.submittedAt?.toISOString() ?? null,
      verifiedByName: sheet.verifiedByName, verifiedAt: sheet.verifiedAt?.toISOString() ?? null,
    },
    students,
    summary,
    canEnter: canEnter && sheet.status === "DRAFT",
    canVerify: canVerify && sheet.status === "SUBMITTED",
  };
}

// ── Bulk save (transactional, no partial success) ────────────────────────────

const markRecordSchema = z
  .object({
    studentId: z.string().min(1),
    status: z.enum(["pending", "marked", "absent", "exempt"]),
    theoryMarks: z.number().int().nullable().optional(),
    practicalMarks: z.number().int().nullable().optional(),
    marksObtained: z.number().int().nullable().optional(),
    remarks: z.string().trim().max(300).nullable().optional(),
  })
  .strict();
const bulkSaveSchema = z.object({ records: z.array(markRecordSchema).min(1).max(300) });

type ValidatedRecord = { studentId: string; status: string; theoryMarks: number | null; practicalMarks: number | null; marksObtained: number | null; remarks: string | null };

function validateRecord(r: z.infer<typeof markRecordSchema>, entry: EntryWithContext): ValidatedRecord {
  const hasSplit = entry.practicalMarks > 0;
  if (r.status === "pending" || r.status === "absent" || r.status === "exempt") {
    if (r.theoryMarks != null || r.practicalMarks != null || r.marksObtained != null) {
      throw new HttpError("INVALID_MARK_COMPONENTS", `A student marked "${r.status}" cannot carry numeric marks — absence is never zero`);
    }
    return { studentId: r.studentId, status: MARK_STATUS_TO_DB[r.status], theoryMarks: null, practicalMarks: null, marksObtained: null, remarks: r.remarks ?? null };
  }
  // status === "marked"
  if (hasSplit) {
    if (r.theoryMarks == null || r.practicalMarks == null) throw new HttpError("INVALID_MARK_COMPONENTS", "Both theory and practical marks are required for this paper");
    if (r.marksObtained != null) throw new HttpError("INVALID_MARK_COMPONENTS", "Provide theory/practical marks, not a combined total — the server computes the total");
    if (r.theoryMarks < 0 || r.practicalMarks < 0) throw new HttpError("INVALID_MARKS", "Marks cannot be negative");
    if (r.theoryMarks > entry.theoryMarks) throw new HttpError("MARKS_EXCEED_MAXIMUM", `Theory marks cannot exceed ${entry.theoryMarks}`);
    if (r.practicalMarks > entry.practicalMarks) throw new HttpError("MARKS_EXCEED_MAXIMUM", `Practical marks cannot exceed ${entry.practicalMarks}`);
    return { studentId: r.studentId, status: "MARKED", theoryMarks: r.theoryMarks, practicalMarks: r.practicalMarks, marksObtained: r.theoryMarks + r.practicalMarks, remarks: r.remarks ?? null };
  }
  if (r.marksObtained == null) throw new HttpError("INVALID_MARK_COMPONENTS", "Marks obtained is required for this paper");
  if (r.theoryMarks != null || r.practicalMarks != null) throw new HttpError("INVALID_MARK_COMPONENTS", "This paper has no theory/practical split — provide marksObtained only");
  if (r.marksObtained < 0) throw new HttpError("INVALID_MARKS", "Marks cannot be negative");
  if (r.marksObtained > entry.maxMarks) throw new HttpError("MARKS_EXCEED_MAXIMUM", `Marks cannot exceed ${entry.maxMarks}`);
  return { studentId: r.studentId, status: "MARKED", theoryMarks: null, practicalMarks: null, marksObtained: r.marksObtained, remarks: r.remarks ?? null };
}

export async function saveMarks(scope: OrgScope, examId: string, entryId: string, raw: unknown): Promise<ExamMarksRosterDto> {
  const input = parseInput(bulkSaveSchema, raw);
  await requireExamInScope(scope, examId);
  const entry = await requireEntryInScope(scope, examId, entryId);
  const sheet = await getOrCreateMarkSheet(scope, entry);
  await assertCanMutateMarks(scope, entry, sheet.status);

  const seen = new Set<string>();
  for (const r of input.records) {
    if (seen.has(r.studentId)) throw new HttpError("DUPLICATE_STUDENT_MARK", "The same student appears more than once in this request");
    seen.add(r.studentId);
  }

  const [eligible, existing] = await Promise.all([
    prisma.enrollment.findMany({ where: { sectionId: entry.sectionId, status: "ENROLLED" }, select: { id: true, studentId: true } }),
    prisma.examMark.findMany({ where: { markSheetId: sheet.id }, select: { studentId: true, enrollmentId: true } }),
  ]);
  const enrollmentByStudent = new Map(eligible.map((e) => [e.studentId, e.id]));
  const existingEnrollmentByStudent = new Map(existing.map((m) => [m.studentId, m.enrollmentId]));
  const allowed = new Set([...enrollmentByStudent.keys(), ...existingEnrollmentByStudent.keys()]);

  const validated: ValidatedRecord[] = [];
  for (const r of input.records) {
    if (!allowed.has(r.studentId)) throw new HttpError("STUDENT_NOT_ELIGIBLE_FOR_EXAM", "This student is not enrolled in the paper's section");
    validated.push(validateRecord(r, entry));
  }

  await prisma.$transaction(async (tx) => {
    // Re-check the lifecycle transactionally — a concurrent submit/verify may
    // have landed between our pre-check above and this write.
    const fresh = await tx.examMarkSheet.findUniqueOrThrow({ where: { id: sheet.id }, select: { status: true } });
    if (fresh.status === "VERIFIED") throw new HttpError("MARKS_LOCKED", "Marks have been verified and are locked");
    if (fresh.status === "SUBMITTED" && !(await isBroadMarksManager(scope))) throw new HttpError("MARKS_ALREADY_SUBMITTED", "Marks have been submitted and can no longer be edited");

    for (const v of validated) {
      const enrollmentId = enrollmentByStudent.get(v.studentId) ?? existingEnrollmentByStudent.get(v.studentId) ?? null;
      await tx.examMark.upsert({
        where: { markSheetId_studentId: { markSheetId: sheet.id, studentId: v.studentId } },
        create: {
          tenantId: scope.tenantId, schoolId: scope.schoolId, academicSessionId: requireSession(scope), markSheetId: sheet.id, studentId: v.studentId, enrollmentId,
          status: v.status as never, theoryMarks: v.theoryMarks, practicalMarks: v.practicalMarks, marksObtained: v.marksObtained, remarks: v.remarks,
          enteredByUserId: scope.actor.id, enteredByName: scope.actor.name, enteredAt: new Date(),
        },
        update: {
          status: v.status as never, theoryMarks: v.theoryMarks, practicalMarks: v.practicalMarks, marksObtained: v.marksObtained, remarks: v.remarks,
          enteredByUserId: scope.actor.id, enteredByName: scope.actor.name, enteredAt: new Date(),
        },
      });
    }
    await recordAudit(tx, scope, "EXAM_MARKS_SAVED", "ExamMarkSheet", sheet.id, { examId, entryId, sectionId: entry.sectionId, subjectId: entry.subjectId, recordCount: validated.length });
  });
  return getMarksRoster(scope, examId, entryId);
}

// ── Lifecycle: submit / verify ────────────────────────────────────────────────

export async function submitMarks(scope: OrgScope, examId: string, entryId: string): Promise<ExamMarksRosterDto> {
  await requireExamInScope(scope, examId);
  const entry = await requireEntryInScope(scope, examId, entryId);
  const sheet = await getOrCreateMarkSheet(scope, entry);
  await assertCanMutateMarks(scope, entry, sheet.status);

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.examMarkSheet.findUniqueOrThrow({ where: { id: sheet.id }, select: { status: true } });
    if (fresh.status === "VERIFIED") throw new HttpError("MARKS_LOCKED", "Marks have been verified and are locked");
    if (fresh.status === "SUBMITTED") throw new HttpError("MARKS_ALREADY_SUBMITTED", "Marks have already been submitted");
    await tx.examMarkSheet.update({ where: { id: sheet.id }, data: { status: "SUBMITTED", submittedByUserId: scope.actor.id, submittedByName: scope.actor.name, submittedAt: new Date() } });
    await recordAudit(tx, scope, "EXAM_MARKS_SUBMITTED", "ExamMarkSheet", sheet.id, { examId, entryId, sectionId: entry.sectionId, subjectId: entry.subjectId });
  });
  return getMarksRoster(scope, examId, entryId);
}

export async function verifyMarks(scope: OrgScope, examId: string, entryId: string): Promise<ExamMarksRosterDto> {
  await requireExamInScope(scope, examId);
  const entry = await requireEntryInScope(scope, examId, entryId);
  const sheet = await getOrCreateMarkSheet(scope, entry);
  // marks.verify is only ever granted to SCHOOL_ADMIN/PRINCIPAL (see catalog.ts),
  // so this doubles as defense-in-depth against a future broader grant. Self-
  // verification (verifier === enterer) is deliberately ALLOWED — no product
  // policy distinguishes it, and the safe default is "SCHOOL_ADMIN/PRINCIPAL may
  // verify regardless of who entered" per the Phase 8B spec.
  if (!(await isBroadMarksManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.examMarkSheet.findUniqueOrThrow({ where: { id: sheet.id }, select: { status: true } });
    if (fresh.status === "VERIFIED") throw new HttpError("MARKS_LOCKED", "Marks have already been verified");
    if (fresh.status === "DRAFT") throw new HttpError("VALIDATION_ERROR", "Marks must be submitted before they can be verified");
    await tx.examMarkSheet.update({ where: { id: sheet.id }, data: { status: "VERIFIED", verifiedByUserId: scope.actor.id, verifiedByName: scope.actor.name, verifiedAt: new Date() } });
    await recordAudit(tx, scope, "EXAM_MARKS_VERIFIED", "ExamMarkSheet", sheet.id, { examId, entryId, sectionId: entry.sectionId, subjectId: entry.subjectId });
  });
  return getMarksRoster(scope, examId, entryId);
}

// ── Summary list (Marks hub / verification queue) ────────────────────────────
// Lightweight, no per-student detail — three batched queries regardless of how
// many papers exist, avoiding an N+1 across exams/entries.

export async function listMarksSummary(scope: OrgScope, params: { examId?: string } = {}): Promise<ExamMarksSummaryItemDto[]> {
  const entries = await prisma.examScheduleEntry.findMany({
    where: {
      schoolId: scope.schoolId, academicSessionId: requireSession(scope),
      exam: { status: { notIn: ["DRAFT", "ARCHIVED"] } },
      ...(params.examId ? { examId: params.examId } : {}),
    },
    orderBy: [{ examDate: "desc" }],
    select: {
      id: true, examId: true, examDate: true,
      exam: { select: { name: true } },
      section: { select: { id: true, name: true, classId: true, class: { select: { name: true } } } },
      subject: { select: { id: true, code: true, name: true, color: true } },
    },
  });
  if (entries.length === 0) return [];

  const entryIds = entries.map((e) => e.id);
  const sheets = await prisma.examMarkSheet.findMany({ where: { examScheduleEntryId: { in: entryIds } }, select: { id: true, examScheduleEntryId: true, status: true } });
  const sheetByEntry = new Map(sheets.map((s) => [s.examScheduleEntryId, s]));

  const sheetIds = sheets.map((s) => s.id);
  // Total roster size isn't derivable from ExamMark rows alone (a student with no
  // row yet has none) — count real Enrollment per section instead, batched once.
  const sectionIds = [...new Set(entries.map((e) => e.section.id))];
  const [enteredCounts, enrollmentCounts] = await Promise.all([
    prisma.examMark.groupBy({ by: ["markSheetId"], where: { markSheetId: { in: sheetIds }, status: { not: "PENDING" } }, _count: { _all: true } }),
    prisma.enrollment.groupBy({ by: ["sectionId"], where: { sectionId: { in: sectionIds }, status: "ENROLLED" }, _count: { _all: true } }),
  ]);
  const rosterBySection = new Map(enrollmentCounts.map((c) => [c.sectionId, c._count._all]));
  const enteredBySheet = new Map(enteredCounts.map((c) => [c.markSheetId, c._count._all]));

  return entries.map((e) => {
    const sheet = sheetByEntry.get(e.id);
    return {
      entryId: e.id, examId: e.examId, examName: e.exam.name, examDate: dateToUi(e.examDate),
      section: { id: e.section.id, name: e.section.name, classId: e.section.classId, className: e.section.class.name },
      subject: { id: e.subject.id, code: e.subject.code, name: e.subject.name, color: e.subject.color },
      sheetStatus: sheet ? SHEET_STATUS_TO_UI[sheet.status] : "draft",
      totalStudents: rosterBySection.get(e.section.id) ?? 0,
      enteredCount: sheet ? (enteredBySheet.get(sheet.id) ?? 0) : 0,
    };
  });
}

// ── Delete-guard export (used by schedule-service to protect recorded marks) ──

export async function scheduleEntryHasRecordedMarks(entryId: string): Promise<boolean> {
  const sheet = await prisma.examMarkSheet.findUnique({ where: { examScheduleEntryId: entryId }, select: { id: true, status: true } });
  if (!sheet) return false;
  if (sheet.status !== "DRAFT") return true;
  const anyRecorded = await prisma.examMark.findFirst({ where: { markSheetId: sheet.id, status: { not: "PENDING" } }, select: { id: true } });
  return Boolean(anyRecorded);
}
