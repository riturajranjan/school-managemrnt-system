// Counseling Sessions (Phase 9S) — factual scheduling/summary metadata only.
// summary is non-confidential (case metadata); detailed confidential content
// belongs exclusively in CounselingSessionNote (see notes.ts).
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { CounselingSessionDto } from "@/lib/api/contracts";
import { requireActingStaffId, staffDisplayName } from "./access";
import { requireCaseInScope } from "./cases";

type Row = {
  id: string; caseId: string; counselorStaffId: string; sessionDate: Date; endedAt: Date | null;
  sessionType: string | null; summary: string | null; followUpDate: Date | null; createdAt: Date; updatedAt: Date;
  counselor: { firstName: string; lastName: string | null; displayName: string | null };
  _count: { notes: number };
};

const select = {
  id: true, caseId: true, counselorStaffId: true, sessionDate: true, endedAt: true, sessionType: true,
  summary: true, followUpDate: true, createdAt: true, updatedAt: true,
  counselor: { select: { firstName: true, lastName: true, displayName: true } },
  _count: { select: { notes: true } },
} satisfies Prisma.CounselingSessionSelect;

function dto(s: Row): CounselingSessionDto {
  return {
    id: s.id, caseId: s.caseId, counselorStaffId: s.counselorStaffId, counselorName: staffDisplayName(s.counselor),
    sessionDate: s.sessionDate.toISOString(), endedAt: s.endedAt?.toISOString() ?? null, sessionType: s.sessionType,
    summary: s.summary, followUpDate: s.followUpDate?.toISOString().slice(0, 10) ?? null, noteCount: s._count.notes,
    createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString(),
  };
}

export async function listSessionsForCase(scope: OrgScope, caseId: string): Promise<CounselingSessionDto[]> {
  await requireCaseInScope(scope, caseId);
  const rows = await prisma.counselingSession.findMany({ where: { caseId }, select, orderBy: { sessionDate: "desc" } });
  return rows.map(dto);
}

async function requireSessionRow(scope: OrgScope, sessionId: string): Promise<Row & { case: { id: string; assignedCounselorStaffId: string | null; schoolId: string; branchId: string } }> {
  const row = await prisma.counselingSession.findFirst({
    where: { id: sessionId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select: { ...select, case: { select: { id: true, assignedCounselorStaffId: true, schoolId: true, branchId: true } } },
  });
  if (!row) throw new HttpError("COUNSELING_SESSION_NOT_FOUND", "Session not found");
  return row;
}

export async function getSession(scope: OrgScope, sessionId: string) {
  return requireSessionRow(scope, sessionId);
}

export async function getSessionDto(scope: OrgScope, sessionId: string): Promise<CounselingSessionDto> {
  return dto(await requireSessionRow(scope, sessionId));
}

export const createSessionSchema = z.object({
  sessionDate: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
  sessionType: z.string().trim().max(60).optional(),
  summary: z.string().trim().max(1000).optional(),
  followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function createSession(scope: OrgScope, caseId: string, raw: unknown): Promise<CounselingSessionDto> {
  const input = parseInput(createSessionSchema, raw);
  const counselingCase = await requireCaseInScope(scope, caseId);
  if (counselingCase.status === "CLOSED") throw new HttpError("COUNSELING_CASE_ALREADY_CLOSED", "This case is closed");
  const counselorStaffId = await requireActingStaffId(scope);

  const row = await prisma.counselingSession.create({
    data: {
      tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: counselingCase.branchId,
      caseId, counselorStaffId,
      sessionDate: input.sessionDate ? new Date(input.sessionDate) : undefined,
      endedAt: input.endedAt ? new Date(input.endedAt) : undefined,
      sessionType: input.sessionType, summary: input.summary,
      followUpDate: input.followUpDate ? new Date(`${input.followUpDate}T00:00:00.000Z`) : undefined,
      createdByUserId: scope.actor.id,
    },
    select,
  });
  await recordAudit(prisma, scope, "COUNSELING_SESSION_CREATED", "CounselingSession", row.id, { caseId });
  return dto(row);
}
