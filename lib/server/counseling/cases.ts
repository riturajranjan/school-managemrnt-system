// Counseling Cases (Phase 9S) — case METADATA only (status, assigned
// counselor, follow-up date, factual referral/summary text). Confidential
// session notes live in a separate model/endpoint entirely (see notes.ts).
// A student may have more than one case at a time — no artificial
// single-open-case constraint is invented.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { createNotification } from "@/lib/server/notifications/service";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { CounselingCaseDto } from "@/lib/api/contracts";
import { requireValidCounselor, requireValidStudent, staffDisplayName, studentDisplayName } from "./access";

type Row = {
  id: string; branchId: string; studentId: string; assignedCounselorStaffId: string | null;
  referralSource: string | null; referralReason: string | null; referredByUserId: string | null; referredAt: Date | null;
  concernCategory: string | null; summary: string | null; status: string; followUpDate: Date | null;
  openedAt: Date; closedAt: Date | null; createdAt: Date; updatedAt: Date;
  student: { firstName: string; lastName: string | null; admissionNumber: string };
  assignedCounselor: { firstName: string; lastName: string | null; displayName: string | null } | null;
  _count: { sessions: number };
};

const select = {
  id: true, branchId: true, studentId: true, assignedCounselorStaffId: true, referralSource: true, referralReason: true,
  referredByUserId: true, referredAt: true, concernCategory: true, summary: true, status: true, followUpDate: true,
  openedAt: true, closedAt: true, createdAt: true, updatedAt: true,
  student: { select: { firstName: true, lastName: true, admissionNumber: true } },
  assignedCounselor: { select: { firstName: true, lastName: true, displayName: true } },
  _count: { select: { sessions: true } },
} satisfies Prisma.CounselingCaseSelect;

function dto(c: Row): CounselingCaseDto {
  return {
    id: c.id, studentId: c.studentId, studentName: studentDisplayName(c.student), admissionNumber: c.student.admissionNumber,
    assignedCounselorStaffId: c.assignedCounselorStaffId,
    assignedCounselorName: c.assignedCounselor ? staffDisplayName(c.assignedCounselor) : null,
    referralSource: c.referralSource ? (c.referralSource.toLowerCase() as CounselingCaseDto["referralSource"]) : null,
    referralReason: c.referralReason, referredByUserId: c.referredByUserId, referredAt: c.referredAt?.toISOString() ?? null,
    concernCategory: c.concernCategory ? (c.concernCategory.toLowerCase() as CounselingCaseDto["concernCategory"]) : null,
    summary: c.summary, status: c.status.toLowerCase() as CounselingCaseDto["status"],
    followUpDate: c.followUpDate?.toISOString().slice(0, 10) ?? null, sessionCount: c._count.sessions,
    openedAt: c.openedAt.toISOString(), closedAt: c.closedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(),
  };
}

export async function listCases(
  scope: OrgScope,
  params: { studentId?: string; status?: string; assignedCounselorStaffId?: string; unassigned?: boolean } = {},
): Promise<CounselingCaseDto[]> {
  const where: Prisma.CounselingCaseWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.studentId) where.studentId = params.studentId;
  if (params.status) where.status = params.status.toUpperCase() as never;
  if (params.assignedCounselorStaffId) where.assignedCounselorStaffId = params.assignedCounselorStaffId;
  if (params.unassigned) where.assignedCounselorStaffId = null;
  const rows = await prisma.counselingCase.findMany({ where, select, orderBy: { openedAt: "desc" } });
  return rows.map(dto);
}

async function requireCaseRow(scope: OrgScope, caseId: string): Promise<Row> {
  const row = await prisma.counselingCase.findFirst({ where: { id: caseId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select });
  if (!row) throw new HttpError("COUNSELING_CASE_NOT_FOUND", "Case not found");
  return row;
}

export async function getCase(scope: OrgScope, caseId: string): Promise<CounselingCaseDto> {
  return dto(await requireCaseRow(scope, caseId));
}

/** Internal — returns the raw row (with assignedCounselorStaffId) for ownership checks elsewhere. */
export async function requireCaseInScope(scope: OrgScope, caseId: string): Promise<Row> {
  return requireCaseRow(scope, caseId);
}

export const createReferralSchema = z.object({
  studentId: z.string().min(1),
  referralSource: z.enum(["self", "teacher", "parent_guardian", "staff", "admin", "other"]).optional(),
  referralReason: z.string().trim().max(1000).optional(),
  concernCategory: z.enum(["academic", "peer_relationships", "behavioral", "family", "emotional_wellbeing", "other"]).optional(),
  summary: z.string().trim().max(1000).optional(),
});

export async function createReferral(scope: OrgScope, raw: unknown): Promise<CounselingCaseDto> {
  const input = parseInput(createReferralSchema, raw);
  const student = await requireValidStudent(scope, input.studentId);

  const row = await prisma.counselingCase.create({
    data: {
      tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: student.branchId, academicSessionId: scope.academicSessionId,
      studentId: input.studentId,
      referralSource: input.referralSource ? (input.referralSource.toUpperCase() as never) : undefined,
      referralReason: input.referralReason, referredByUserId: scope.actor.id, referredAt: new Date(),
      concernCategory: input.concernCategory ? (input.concernCategory.toUpperCase() as never) : undefined,
      summary: input.summary, createdByUserId: scope.actor.id,
    },
    select,
  });
  await recordAudit(prisma, scope, "COUNSELING_CASE_CREATED", "CounselingCase", row.id, { studentId: input.studentId, referralSource: input.referralSource ?? null });
  return dto(row);
}

export const updateCaseSchema = z.object({
  concernCategory: z.enum(["academic", "peer_relationships", "behavioral", "family", "emotional_wellbeing", "other"]).nullable().optional(),
  summary: z.string().trim().max(1000).nullable().optional(),
  followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function updateCase(scope: OrgScope, caseId: string, raw: unknown): Promise<CounselingCaseDto> {
  const input = parseInput(updateCaseSchema, raw);
  const current = await requireCaseRow(scope, caseId);
  if (current.status === "CLOSED") throw new HttpError("COUNSELING_CASE_ALREADY_CLOSED", "This case is closed");

  const row = await prisma.counselingCase.update({
    where: { id: caseId },
    data: {
      concernCategory: input.concernCategory === undefined ? undefined : input.concernCategory === null ? null : (input.concernCategory.toUpperCase() as never),
      summary: input.summary,
      followUpDate: input.followUpDate === undefined ? undefined : input.followUpDate === null ? null : new Date(`${input.followUpDate}T00:00:00.000Z`),
    },
    select,
  });

  const onlyFollowUp = "followUpDate" in input && !("concernCategory" in input) && !("summary" in input);
  await recordAudit(prisma, scope, onlyFollowUp ? "COUNSELING_FOLLOWUP_UPDATED" : "COUNSELING_CASE_UPDATED", "CounselingCase", caseId, {});
  return dto(row);
}

export const assignCaseSchema = z.object({ counselorStaffId: z.string().min(1) });

export async function assignCase(scope: OrgScope, caseId: string, raw: unknown): Promise<CounselingCaseDto> {
  const input = parseInput(assignCaseSchema, raw);
  const current = await requireCaseRow(scope, caseId);
  if (current.status === "CLOSED") throw new HttpError("COUNSELING_CASE_ALREADY_CLOSED", "This case is closed");
  const counselor = await requireValidCounselor(scope, input.counselorStaffId);

  await prisma.$transaction(async (tx) => {
    await tx.counselingCase.update({ where: { id: caseId }, data: { assignedCounselorStaffId: input.counselorStaffId, status: "ACTIVE" } });
    await recordAudit(tx, scope, "COUNSELING_CASE_ASSIGNED", "CounselingCase", caseId, { counselorStaffId: input.counselorStaffId });

    const counselorUser = await tx.staff.findUnique({ where: { id: counselor.id }, select: { userId: true } });
    if (counselorUser?.userId) {
      await createNotification(tx, {
        tenantId: scope.tenantId, schoolId: scope.schoolId, type: "COUNSELING_CASE_ASSIGNED",
        title: "Counseling case assigned to you", body: "A counseling case has been assigned to you.",
        href: "/counselling/appointments", sourceType: "CounselingCase", sourceId: caseId,
        dedupeKey: `COUNSELING_CASE_ASSIGNED:${caseId}:${input.counselorStaffId}`, recipientUserIds: [counselorUser.userId],
      });
    }
  });
  return getCase(scope, caseId);
}

export async function closeCase(scope: OrgScope, caseId: string): Promise<CounselingCaseDto> {
  const current = await requireCaseRow(scope, caseId);
  if (current.status === "CLOSED") throw new HttpError("COUNSELING_CASE_ALREADY_CLOSED", "This case is already closed");
  const updated = await prisma.counselingCase.updateMany({ where: { id: caseId, status: { not: "CLOSED" } }, data: { status: "CLOSED", closedAt: new Date() } });
  if (updated.count === 0) throw new HttpError("COUNSELING_CASE_ALREADY_CLOSED", "This case is already closed");
  await recordAudit(prisma, scope, "COUNSELING_CASE_CLOSED", "CounselingCase", caseId, {});
  return getCase(scope, caseId);
}
