// Promotion / Academic-Year Transition (Phase 8E). An explicit, auditable
// ADMINISTRATIVE decision — never an automatic consequence of an exam result.
// A StudentPromotion row only gets created once PROMOTED or RETAINED is
// finalized; "pending" is the absence of a row for a (student, fromSession,
// toSession) transition, computed here from real Enrollment/StudentExamResult
// facts. PROMOTED and RETAINED are symmetric: both create a NEW Enrollment in
// the target session (never mutate the historical one) — the only difference
// is which target Class the admin picked and the audit action recorded.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ListMeta } from "@/lib/server/api/response";
import type {
  ExamResultStatus,
  PromotionCandidateDto,
  PromotionDecisionDto,
  PromotionEligibilityStateDto,
  PromotionListItemDto,
} from "@/lib/api/contracts";

function requireSession(scope: OrgScope): string {
  if (!scope.academicSessionId) throw new HttpError("INVALID_SESSION", "Select an academic session first");
  return scope.academicSessionId;
}

const DECISION_TO_DB: Record<PromotionDecisionDto, "PROMOTED" | "RETAINED"> = { promoted: "PROMOTED", retained: "RETAINED" };
const decisionToUi = (d: string): PromotionDecisionDto => d.toLowerCase() as PromotionDecisionDto;

// ── Shared lookups ───────────────────────────────────────────────────────────

/** The exam's publication, scoped to the CALLER'S CURRENT (source) session —
 *  the only session a "current" exam/result can legitimately live in. */
async function requireSourcePublication(scope: OrgScope, examId: string) {
  const exam = await prisma.exam.findFirst({ where: { id: examId, schoolId: scope.schoolId, academicSessionId: requireSession(scope) }, select: { id: true } });
  if (!exam) throw new HttpError("EXAM_NOT_FOUND", "Exam not found");
  const publication = await prisma.examResultPublication.findUnique({ where: { examId }, select: { id: true } });
  return { examId, publication };
}

/** A real target AcademicSession for this school, distinct from the caller's
 *  current (source) session. Never trusted blindly from the browser. */
async function requireTargetSession(scope: OrgScope, targetAcademicSessionId: string): Promise<{ id: string; name: string }> {
  if (targetAcademicSessionId === scope.academicSessionId) {
    throw new HttpError("INVALID_TARGET_SESSION", "The target academic session must be different from the current session");
  }
  const session = await prisma.academicSession.findFirst({ where: { id: targetAcademicSessionId, schoolId: scope.schoolId }, select: { id: true, name: true } });
  if (!session) throw new HttpError("INVALID_TARGET_SESSION", "Target academic session not found");
  return session;
}

// ── Candidates ───────────────────────────────────────────────────────────────

export const listCandidatesSchema = z.object({
  examId: z.string().min(1),
  targetAcademicSessionId: z.string().min(1),
  classId: z.string().min(1).optional(),
  sectionId: z.string().min(1).optional(),
});

export async function listPromotionCandidates(scope: OrgScope, raw: unknown): Promise<PromotionCandidateDto[]> {
  const input = parseInput(listCandidatesSchema, raw);
  const sourceSessionId = requireSession(scope);
  const targetSession = await requireTargetSession(scope, input.targetAcademicSessionId);
  const { publication } = await requireSourcePublication(scope, input.examId);

  const enrollments = await prisma.enrollment.findMany({
    where: {
      schoolId: scope.schoolId, academicSessionId: sourceSessionId, status: "ENROLLED",
      ...(input.classId ? { classId: input.classId } : {}),
      ...(input.sectionId ? { sectionId: input.sectionId } : {}),
    },
    select: {
      id: true, studentId: true, classId: true, sectionId: true,
      class: { select: { name: true } }, section: { select: { name: true } },
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true, rollNumber: true } },
    },
    orderBy: [{ student: { firstName: "asc" } }],
  });
  if (enrollments.length === 0) return [];

  const studentIds = enrollments.map((e) => e.studentId);

  const [results, existing] = await Promise.all([
    publication
      ? prisma.studentExamResult.findMany({ where: { publicationId: publication.id, studentId: { in: studentIds } }, select: { id: true, studentId: true, status: true, percentage: true, grade: true } })
      : Promise.resolve([]),
    prisma.studentPromotion.findMany({
      where: { studentId: { in: studentIds }, fromAcademicSessionId: sourceSessionId, toAcademicSessionId: targetSession.id },
      select: promotionSelect,
    }),
  ]);
  const resultByStudent = new Map(results.map((r) => [r.studentId, r]));
  const existingByStudent = new Map(existing.map((p) => [p.student.id, p]));
  const sessionNames = await sessionNameMap(scope.schoolId, [sourceSessionId, targetSession.id]);

  return enrollments.map((en): PromotionCandidateDto => {
    const result = resultByStudent.get(en.studentId) ?? null;
    const existingPromotion = existingByStudent.get(en.studentId);

    let eligibility: { state: PromotionEligibilityStateDto; reasons: string[] };
    if (existingPromotion) {
      eligibility = { state: "already_processed", reasons: [`Already ${decisionToUi(existingPromotion.decision)} on ${existingPromotion.processedAt.toISOString()}`] };
    } else if (!publication) {
      eligibility = { state: "blocked_result_unpublished", reasons: ["Results for this exam have not been published yet"] };
    } else if (!result) {
      eligibility = { state: "blocked_result_incomplete", reasons: ["No published result for this student on this exam"] };
    } else {
      const reasons: string[] = [];
      if (result.status === "ABSENT") reasons.push("Student was absent for this exam");
      eligibility = { state: "ready", reasons };
    }

    return {
      student: { id: en.student.id, name: `${en.student.firstName} ${en.student.lastName}`.trim(), admissionNumber: en.student.admissionNumber, rollNumber: en.student.rollNumber },
      currentEnrollment: { id: en.id, classId: en.classId, className: en.class.name, sectionId: en.sectionId, sectionName: en.section.name },
      result: result ? { studentExamResultId: result.id, status: result.status.toLowerCase() as ExamResultStatus, percentage: result.percentage, grade: result.grade } : null,
      eligibility,
      existingPromotion: existingPromotion ? promotionListItemDto(existingPromotion, sessionNames) : null,
    };
  });
}

// ── History / single record ──────────────────────────────────────────────────

const promotionSelect = {
  id: true, decision: true, targetClassId: true, targetSectionId: true, sourceExamId: true, notes: true, processedAt: true, processedByName: true,
  fromAcademicSessionId: true, toAcademicSessionId: true,
  student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
  targetClass: { select: { id: true, name: true } },
  targetSection: { select: { id: true, name: true } },
  fromEnrollment: { select: { class: { select: { name: true } }, section: { select: { name: true } } } },
} satisfies Prisma.StudentPromotionSelect;

type PromotionRow = Prisma.StudentPromotionGetPayload<{ select: typeof promotionSelect }>;

async function sessionNameMap(schoolId: string, ids: string[]): Promise<Map<string, string>> {
  const rows = await prisma.academicSession.findMany({ where: { schoolId, id: { in: [...new Set(ids)] } }, select: { id: true, name: true } });
  return new Map(rows.map((r) => [r.id, r.name]));
}

function promotionListItemDto(p: PromotionRow, sessionNames: Map<string, string>): PromotionListItemDto {
  return {
    id: p.id,
    student: { id: p.student.id, name: `${p.student.firstName} ${p.student.lastName}`.trim(), admissionNumber: p.student.admissionNumber },
    fromSession: { id: p.fromAcademicSessionId, name: sessionNames.get(p.fromAcademicSessionId) ?? p.fromAcademicSessionId },
    toSession: { id: p.toAcademicSessionId, name: sessionNames.get(p.toAcademicSessionId) ?? p.toAcademicSessionId },
    fromClassName: p.fromEnrollment.class.name, fromSectionName: p.fromEnrollment.section.name,
    decision: decisionToUi(p.decision),
    targetClass: p.targetClass, targetSection: p.targetSection,
    sourceExamId: p.sourceExamId, notes: p.notes,
    processedAt: p.processedAt.toISOString(), processedByName: p.processedByName,
  };
}

export async function getPromotion(scope: OrgScope, promotionId: string): Promise<PromotionListItemDto> {
  const row = await prisma.studentPromotion.findFirst({ where: { id: promotionId, schoolId: scope.schoolId }, select: promotionSelect });
  if (!row) throw new HttpError("NOT_FOUND", "Promotion record not found");
  const sessionNames = await sessionNameMap(scope.schoolId, [row.fromAcademicSessionId, row.toAcademicSessionId]);
  return promotionListItemDto(row, sessionNames);
}

export const listPromotionsSchema = z.object({
  fromAcademicSessionId: z.string().min(1).optional(),
  toAcademicSessionId: z.string().min(1).optional(),
  examId: z.string().min(1).optional(),
  targetClassId: z.string().min(1).optional(),
  targetSectionId: z.string().min(1).optional(),
  decision: z.enum(["promoted", "retained"]).optional(),
  search: z.string().trim().min(1).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export async function listPromotions(scope: OrgScope, raw: unknown): Promise<{ data: PromotionListItemDto[]; meta: ListMeta }> {
  const input = parseInput(listPromotionsSchema, raw);
  const where: Prisma.StudentPromotionWhereInput = {
    schoolId: scope.schoolId,
    ...(input.fromAcademicSessionId ? { fromAcademicSessionId: input.fromAcademicSessionId } : {}),
    ...(input.toAcademicSessionId ? { toAcademicSessionId: input.toAcademicSessionId } : {}),
    ...(input.examId ? { sourceExamId: input.examId } : {}),
    ...(input.targetClassId ? { targetClassId: input.targetClassId } : {}),
    ...(input.targetSectionId ? { targetSectionId: input.targetSectionId } : {}),
    ...(input.decision ? { decision: DECISION_TO_DB[input.decision] } : {}),
    ...(input.search
      ? { student: { OR: [{ firstName: { contains: input.search, mode: "insensitive" } }, { lastName: { contains: input.search, mode: "insensitive" } }, { admissionNumber: { contains: input.search, mode: "insensitive" } }] } }
      : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.studentPromotion.count({ where }),
    prisma.studentPromotion.findMany({ where, select: promotionSelect, orderBy: [{ processedAt: "desc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
  ]);
  const sessionNames = await sessionNameMap(scope.schoolId, rows.flatMap((r) => [r.fromAcademicSessionId, r.toAcademicSessionId]));
  return {
    data: rows.map((r) => promotionListItemDto(r, sessionNames)),
    meta: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.max(1, Math.ceil(total / input.pageSize)) },
  };
}

// ── Process (atomic, concurrency-safe) ────────────────────────────────────────

export const processPromotionSchema = z.object({
  studentId: z.string().min(1),
  sourceStudentResultId: z.string().min(1),
  targetAcademicSessionId: z.string().min(1),
  decision: z.enum(["promoted", "retained"]),
  targetClassId: z.string().min(1),
  targetSectionId: z.string().min(1),
  notes: z.string().trim().max(500).optional(),
});

export async function processPromotion(scope: OrgScope, raw: unknown): Promise<PromotionListItemDto> {
  const input = parseInput(processPromotionSchema, raw);
  const sourceSessionId = requireSession(scope);
  const targetSession = await requireTargetSession(scope, input.targetAcademicSessionId);

  const student = await prisma.student.findFirst({ where: { id: input.studentId, schoolId: scope.schoolId }, select: { id: true } });
  if (!student) throw new HttpError("NOT_FOUND", "Student not found");

  const fromEnrollment = await prisma.enrollment.findFirst({
    where: { studentId: input.studentId, schoolId: scope.schoolId, academicSessionId: sourceSessionId, status: "ENROLLED" },
    select: { id: true },
  });
  if (!fromEnrollment) throw new HttpError("NO_CURRENT_ENROLLMENT", "This student has no active enrollment in the current academic session");

  // Never trust percentage/grade/status/class from the client — re-derive the
  // ENTIRE evidence trail from the real published snapshot.
  const sourceResult = await prisma.studentExamResult.findFirst({
    where: { id: input.sourceStudentResultId, studentId: input.studentId },
    select: { id: true, publicationId: true, publication: { select: { examId: true, schoolId: true, academicSessionId: true } } },
  });
  if (!sourceResult || sourceResult.publication.schoolId !== scope.schoolId || sourceResult.publication.academicSessionId !== sourceSessionId) {
    throw new HttpError("STUDENT_RESULT_NOT_FOUND", "No published result for this student matching this exam");
  }

  const targetClass = await prisma.class.findFirst({ where: { id: input.targetClassId, schoolId: scope.schoolId, academicSessionId: targetSession.id }, select: { id: true } });
  if (!targetClass) throw new HttpError("TARGET_CLASS_NOT_FOUND", "Target class not found in the target academic session");

  const targetSectionRow = await prisma.section.findFirst({ where: { id: input.targetSectionId, schoolId: scope.schoolId, academicSessionId: targetSession.id, classId: input.targetClassId }, select: { id: true, branchId: true, capacity: true } });
  if (!targetSectionRow) throw new HttpError("TARGET_SECTION_NOT_FOUND", "Target section not found in the target class/session");

  // Fast idempotency check (not authoritative — the DB unique constraints
  // below are the real concurrency guarantee) so a plain repeat request gets
  // a clear, immediate answer instead of racing a doomed transaction.
  const already = await prisma.studentPromotion.findUnique({
    where: { studentId_fromAcademicSessionId_toAcademicSessionId: { studentId: input.studentId, fromAcademicSessionId: sourceSessionId, toAcademicSessionId: targetSession.id } },
    select: { id: true },
  });
  if (already) throw new HttpError("PROMOTION_ALREADY_PROCESSED", "This student has already been promoted/retained for this transition");

  try {
    const created = await prisma.$transaction(async (tx) => {
      // Row-lock the target section for the duration of the capacity check +
      // insert, so two concurrent promotions into the same last slot can never
      // both succeed — the second waits, re-reads the now-updated count, and
      // fails closed.
      await tx.$queryRaw`SELECT id FROM sections WHERE id = ${targetSectionRow.id} FOR UPDATE`;
      const enrolledCount = await tx.enrollment.count({ where: { sectionId: targetSectionRow.id, status: "ENROLLED" } });
      if (enrolledCount >= targetSectionRow.capacity) throw new HttpError("SECTION_CAPACITY_EXCEEDED", "The target section is at capacity");

      const newEnrollment = await tx.enrollment.create({
        data: {
          tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: targetSectionRow.branchId, academicSessionId: targetSession.id,
          classId: input.targetClassId, sectionId: input.targetSectionId, studentId: input.studentId, status: "ENROLLED",
        },
        select: { id: true },
      });

      const promotion = await tx.studentPromotion.create({
        data: {
          tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: targetSectionRow.branchId,
          fromAcademicSessionId: sourceSessionId, toAcademicSessionId: targetSession.id,
          studentId: input.studentId, fromEnrollmentId: fromEnrollment.id, newEnrollmentId: newEnrollment.id,
          sourceExamId: sourceResult.publication.examId, sourcePublicationId: sourceResult.publicationId, sourceStudentResultId: sourceResult.id,
          decision: DECISION_TO_DB[input.decision], targetClassId: input.targetClassId, targetSectionId: input.targetSectionId,
          processedByUserId: scope.actor.id, processedByName: scope.actor.name, notes: input.notes ?? null,
        },
        select: promotionSelect,
      });

      await recordAudit(tx, scope, input.decision === "promoted" ? "STUDENT_PROMOTED" : "STUDENT_RETAINED", "Student", input.studentId, {
        fromEnrollmentId: fromEnrollment.id, newEnrollmentId: newEnrollment.id, fromSessionId: sourceSessionId, toSessionId: targetSession.id,
        sourceExamId: sourceResult.publication.examId, sourceResultId: sourceResult.id, targetClassId: input.targetClassId, targetSectionId: input.targetSectionId, decision: input.decision,
      });

      return promotion;
    });
    const sessionNames = await sessionNameMap(scope.schoolId, [created.fromAcademicSessionId, created.toAcademicSessionId]);
    return promotionListItemDto(created, sessionNames);
  } catch (e) {
    if (e instanceof HttpError) throw e;
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new HttpError("PROMOTION_ALREADY_PROCESSED", "This student has already been promoted/retained for this transition");
    }
    throw e;
  }
}
