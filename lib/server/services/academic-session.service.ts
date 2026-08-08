import "server-only";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError, ValidationError } from "../errors";
import { mapPrismaError } from "../prisma-errors";
import { requirePermission } from "../permissions";
import { assertSchoolAccess, type RequestContext } from "../authz";
import { recordAudit } from "../audit";
import { runInTransaction } from "../tx";
import { parseCalendarDate } from "../datetime";
import { createAcademicSessionInput } from "../validation/organization";

// Academic session service. Demonstrates the transaction pattern and a
// business-rule invariant the DB can't express cleanly on its own: at most one
// CURRENT session per school.

export async function listSessions(ctx: RequestContext, schoolId: string) {
  requirePermission(ctx, "session.view");
  await assertSchoolInTenant(ctx, schoolId);
  assertSchoolAccess(ctx, schoolId);
  return prisma.academicSession.findMany({ where: { schoolId }, orderBy: { startDate: "desc" } });
}

export async function createSession(ctx: RequestContext, schoolId: string, rawInput: unknown) {
  requirePermission(ctx, "session.manage");
  await assertSchoolInTenant(ctx, schoolId);
  assertSchoolAccess(ctx, schoolId);

  const parsed = createAcademicSessionInput.safeParse(rawInput);
  if (!parsed.success) throw new ValidationError("Invalid session details.", { issues: parsed.error.issues });
  const input = parsed.data;

  try {
    const session = await prisma.academicSession.create({
      data: {
        schoolId,
        name: input.name,
        code: input.code,
        startDate: parseCalendarDate(input.startDate),
        endDate: parseCalendarDate(input.endDate),
      },
    });
    await recordAudit({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      action: "session.created",
      entityType: "AcademicSession",
      entityId: session.id,
      metadata: { schoolId, code: session.code },
    });
    return session;
  } catch (e) {
    mapPrismaError(e, { conflictMessage: `A session with code "${input.code}" already exists in this school.` });
  }
}

// Atomically make one session current and clear the flag on all others in the
// same school — the single-current invariant, enforced in a transaction.
export async function setCurrentSession(ctx: RequestContext, schoolId: string, sessionId: string) {
  requirePermission(ctx, "session.manage");
  await assertSchoolInTenant(ctx, schoolId);
  assertSchoolAccess(ctx, schoolId);

  const target = await prisma.academicSession.findFirst({
    where: { id: sessionId, schoolId },
    select: { id: true },
  });
  if (!target) throw new NotFoundError("Academic session not found.");

  await runInTransaction(async (tx) => {
    await tx.academicSession.updateMany({ where: { schoolId, isCurrent: true }, data: { isCurrent: false } });
    await tx.academicSession.update({ where: { id: sessionId }, data: { isCurrent: true, status: "ACTIVE" } });
    await recordAudit(
      {
        tenantId: ctx.tenantId,
        actorUserId: ctx.userId,
        action: "session.setCurrent",
        entityType: "AcademicSession",
        entityId: sessionId,
        metadata: { schoolId },
      },
      tx,
    );
  });
}

async function assertSchoolInTenant(ctx: RequestContext, schoolId: string): Promise<void> {
  const school = await prisma.school.findFirst({
    where: { id: schoolId, tenantId: ctx.tenantId },
    select: { id: true },
  });
  if (!school) throw new NotFoundError("School not found.");
}
