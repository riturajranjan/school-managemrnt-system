// Activity Event Participants (Phase 9U) — a real Student's registration/
// attendance for one event. Deliberately NOT academic Attendance — a fully
// separate operational fact. Registration is open to any real, active
// Student in the school (no membership-only restriction — no real product
// policy defines one).
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ActivityEventParticipantDto } from "@/lib/api/contracts";
import { requireValidStudent, studentDisplayName } from "./access";
import { requireEventInScope } from "./events";

type Row = {
  id: string; eventId: string; studentId: string; status: string; registeredAt: Date; attendedAt: Date | null;
  student: { firstName: string; lastName: string | null; admissionNumber: string };
};

const select = {
  id: true, eventId: true, studentId: true, status: true, registeredAt: true, attendedAt: true,
  student: { select: { firstName: true, lastName: true, admissionNumber: true } },
} satisfies Prisma.ActivityEventParticipantSelect;

function dto(p: Row): ActivityEventParticipantDto {
  return {
    id: p.id, eventId: p.eventId, studentId: p.studentId, studentName: studentDisplayName(p.student), admissionNumber: p.student.admissionNumber,
    status: p.status.toLowerCase() as ActivityEventParticipantDto["status"], registeredAt: p.registeredAt.toISOString(), attendedAt: p.attendedAt?.toISOString() ?? null,
  };
}

export async function listParticipants(scope: OrgScope, eventId: string): Promise<ActivityEventParticipantDto[]> {
  await requireEventInScope(scope, eventId);
  const rows = await prisma.activityEventParticipant.findMany({ where: { eventId }, select, orderBy: { registeredAt: "asc" } });
  return rows.map(dto);
}

export const registerParticipantSchema = z.object({ studentId: z.string().min(1) });

export async function registerParticipant(scope: OrgScope, eventId: string, raw: unknown): Promise<ActivityEventParticipantDto> {
  const input = parseInput(registerParticipantSchema, raw);
  const event = await requireEventInScope(scope, eventId);
  if (event.status !== "PUBLISHED") throw new HttpError("INVALID_ACTIVITY_EVENT_TRANSITION", "This event is not open for registration");
  const student = await requireValidStudent(scope, input.studentId);

  let id: string;
  try {
    id = await prisma.$transaction(async (tx) => {
      const row = await tx.activityEventParticipant.create({
        data: { tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: student.branchId, eventId, studentId: input.studentId },
        select: { id: true },
      });
      await recordAudit(tx, scope, "ACTIVITY_PARTICIPANT_REGISTERED", "ActivityEventParticipant", row.id, { eventId, studentId: input.studentId });
      return row.id;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError("ACTIVITY_ALREADY_REGISTERED", "This student is already registered for this event");
    throw e;
  }
  const row = await prisma.activityEventParticipant.findUniqueOrThrow({ where: { id }, select });
  return dto(row);
}

export const updateParticipantSchema = z.object({ status: z.enum(["registered", "attended", "absent", "cancelled"]) });

export async function updateParticipant(scope: OrgScope, eventId: string, participantId: string, raw: unknown): Promise<ActivityEventParticipantDto> {
  const input = parseInput(updateParticipantSchema, raw);
  await requireEventInScope(scope, eventId);
  const current = await prisma.activityEventParticipant.findFirst({ where: { id: participantId, eventId }, select: { id: true } });
  if (!current) throw new HttpError("ACTIVITY_PARTICIPANT_NOT_FOUND", "Participant not found");

  const statusDb = input.status.toUpperCase() as never;
  const row = await prisma.activityEventParticipant.update({
    where: { id: participantId },
    data: { status: statusDb, attendedAt: input.status === "attended" ? new Date() : undefined },
    select,
  });
  await recordAudit(prisma, scope, "ACTIVITY_PARTICIPANT_UPDATED", "ActivityEventParticipant", participantId, { status: input.status });
  return dto(row);
}
