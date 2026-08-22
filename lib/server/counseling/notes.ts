// Confidential Counseling Session Notes (Phase 9S) — CRITICAL: never
// included in any list endpoint or the generic Case/Session DTO. Reading or
// writing a note requires counseling.viewConfidential/counseling.manage AT
// THE ROUTE PLUS ownership (the session's case must be assigned to the
// caller's own Staff.id) enforced here — see access.ts's
// requireOwnCaseForConfidential, which returns 404 (not 403) on failure so a
// counselor cannot even infer that a case they don't own exists.
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { CounselingSessionNoteDto } from "@/lib/api/contracts";
import { requireOwnCaseForConfidential } from "./access";
import { getSession } from "./sessions";

function dto(n: { id: string; sessionId: string; body: string; createdByUserId: string; createdAt: Date; updatedAt: Date }): CounselingSessionNoteDto {
  return { id: n.id, sessionId: n.sessionId, body: n.body, createdByUserId: n.createdByUserId, createdAt: n.createdAt.toISOString(), updatedAt: n.updatedAt.toISOString() };
}

export async function listNotesForSession(scope: OrgScope, sessionId: string): Promise<CounselingSessionNoteDto[]> {
  const session = await getSession(scope, sessionId);
  await requireOwnCaseForConfidential(scope, session.case.assignedCounselorStaffId);
  const rows = await prisma.counselingSessionNote.findMany({ where: { sessionId }, orderBy: { createdAt: "desc" } });
  return rows.map(dto);
}

export const createNoteSchema = z.object({ body: z.string().trim().min(1).max(5000) });

export async function createNote(scope: OrgScope, sessionId: string, raw: unknown): Promise<CounselingSessionNoteDto> {
  const input = parseInput(createNoteSchema, raw);
  const session = await getSession(scope, sessionId);
  await requireOwnCaseForConfidential(scope, session.case.assignedCounselorStaffId);

  const row = await prisma.counselingSessionNote.create({
    data: { tenantId: scope.tenantId, schoolId: session.case.schoolId, branchId: session.case.branchId, sessionId, body: input.body, createdByUserId: scope.actor.id },
  });
  // Who/what/when only — the confidential body is never written into audit metadata.
  await recordAudit(prisma, scope, "COUNSELING_NOTE_CREATED", "CounselingSessionNote", row.id, { sessionId });
  return dto(row);
}
