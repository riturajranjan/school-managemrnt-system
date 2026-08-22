// Activity Student Memberships (Phase 9U) — real, session-scoped, always a
// real, active Student.id. Concurrency-safe "one active membership per
// student per activity per session" via a pre-check (friendly error) backed
// by a real partial unique index (see the schema doc-comment and sibling
// migration) — the Hostel/Health dual-guard pattern.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ActivityMembershipDto } from "@/lib/api/contracts";
import { requireValidStudent, studentDisplayName } from "./access";
import { requireActivityInScope } from "./activities";

type Row = {
  id: string; activityId: string; studentId: string; status: string; joinedAt: Date; leftAt: Date | null;
  activity: { name: string };
  student: { firstName: string; lastName: string | null; admissionNumber: string };
};

const select = {
  id: true, activityId: true, studentId: true, status: true, joinedAt: true, leftAt: true,
  activity: { select: { name: true } },
  student: { select: { firstName: true, lastName: true, admissionNumber: true } },
} satisfies Prisma.ActivityStudentMembershipSelect;

function dto(m: Row): ActivityMembershipDto {
  return {
    id: m.id, activityId: m.activityId, activityName: m.activity.name, studentId: m.studentId,
    studentName: studentDisplayName(m.student), admissionNumber: m.student.admissionNumber,
    status: m.status.toLowerCase() as ActivityMembershipDto["status"], joinedAt: m.joinedAt.toISOString(), leftAt: m.leftAt?.toISOString() ?? null,
  };
}

export async function listMemberships(scope: OrgScope, params: { activityId?: string; studentId?: string; status?: string } = {}): Promise<ActivityMembershipDto[]> {
  const where: Prisma.ActivityStudentMembershipWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.activityId) where.activityId = params.activityId;
  if (params.studentId) where.studentId = params.studentId;
  if (params.status) where.status = params.status.toUpperCase() as never;
  const rows = await prisma.activityStudentMembership.findMany({ where, select, orderBy: { joinedAt: "desc" } });
  return rows.map(dto);
}

export const joinActivitySchema = z.object({ studentId: z.string().min(1) });

export async function joinActivity(scope: OrgScope, activityId: string, raw: unknown): Promise<ActivityMembershipDto> {
  const input = parseInput(joinActivitySchema, raw);
  if (!scope.academicSessionId) throw new HttpError("INVALID_SESSION", "An academic session must be selected");
  await requireActivityInScope(scope, activityId);
  const student = await requireValidStudent(scope, input.studentId);

  const existingActive = await prisma.activityStudentMembership.findFirst({ where: { activityId, studentId: input.studentId, academicSessionId: scope.academicSessionId, status: "ACTIVE" }, select: { id: true } });
  if (existingActive) throw new HttpError("ACTIVITY_ALREADY_MEMBER", "This student already has an active membership in this activity this session");

  let id: string;
  try {
    id = await prisma.$transaction(async (tx) => {
      const row = await tx.activityStudentMembership.create({
        data: { tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: student.branchId, academicSessionId: scope.academicSessionId!, activityId, studentId: input.studentId },
        select: { id: true },
      });
      await recordAudit(tx, scope, "ACTIVITY_STUDENT_JOINED", "ActivityStudentMembership", row.id, { activityId, studentId: input.studentId });
      return row.id;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError("ACTIVITY_ALREADY_MEMBER", "This student already has an active membership in this activity this session");
    throw e;
  }
  const row = await prisma.activityStudentMembership.findUniqueOrThrow({ where: { id }, select });
  return dto(row);
}

export async function leaveActivity(scope: OrgScope, activityId: string, membershipId: string): Promise<ActivityMembershipDto> {
  await requireActivityInScope(scope, activityId);
  const current = await prisma.activityStudentMembership.findFirst({ where: { id: membershipId, activityId }, select: { id: true, status: true } });
  if (!current) throw new HttpError("ACTIVITY_MEMBERSHIP_NOT_FOUND", "Membership not found");
  await prisma.$transaction(async (tx) => {
    const updated = await tx.activityStudentMembership.updateMany({ where: { id: membershipId, status: "ACTIVE" }, data: { status: "ENDED", leftAt: new Date() } });
    if (updated.count === 0) throw new HttpError("ACTIVITY_MEMBERSHIP_NOT_FOUND", "Membership is not active");
    await recordAudit(tx, scope, "ACTIVITY_STUDENT_LEFT", "ActivityStudentMembership", membershipId, {});
  });
  const row = await prisma.activityStudentMembership.findUniqueOrThrow({ where: { id: membershipId }, select });
  return dto(row);
}
