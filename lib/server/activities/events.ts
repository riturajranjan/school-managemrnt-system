// Activity Events (Phase 9U) — real, minimal lifecycle: DRAFT -> PUBLISHED ->
// COMPLETED, or PUBLISHED -> CANCELLED. Replaces the old mock's invented
// 8-stage "journey" with tasks/budget (not built — no real infrastructure
// exists for either). PUBLISHED events are derived live into the real
// Calendar (lib/server/calendar/service.ts) — never a duplicately-stored
// CalendarEvent.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ActivityEventDto } from "@/lib/api/contracts";
import { requireActivityInScope } from "./activities";

type Row = {
  id: string; activityId: string; title: string; description: string | null; startAt: Date; endAt: Date | null;
  location: string | null; status: string; createdAt: Date; updatedAt: Date;
  activity: { name: string };
  _count: { participants: number };
};

const select = {
  id: true, activityId: true, title: true, description: true, startAt: true, endAt: true, location: true, status: true, createdAt: true, updatedAt: true,
  activity: { select: { name: true } },
  _count: { select: { participants: true } },
} satisfies Prisma.ActivityEventSelect;

function dto(e: Row): ActivityEventDto {
  return {
    id: e.id, activityId: e.activityId, activityName: e.activity.name, title: e.title, description: e.description,
    startAt: e.startAt.toISOString(), endAt: e.endAt?.toISOString() ?? null, location: e.location,
    status: e.status.toLowerCase() as ActivityEventDto["status"], participantCount: e._count.participants,
    createdAt: e.createdAt.toISOString(), updatedAt: e.updatedAt.toISOString(),
  };
}

export async function listEvents(scope: OrgScope, params: { activityId?: string; status?: string; upcoming?: boolean; dateFrom?: string; dateTo?: string } = {}): Promise<ActivityEventDto[]> {
  const where: Prisma.ActivityEventWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.activityId) where.activityId = params.activityId;
  if (params.status) where.status = params.status.toUpperCase() as never;
  if (params.upcoming) where.startAt = { gte: new Date() };
  if (params.dateFrom || params.dateTo) {
    where.startAt = {
      ...(typeof where.startAt === "object" ? where.startAt : {}),
      ...(params.dateFrom ? { gte: new Date(`${params.dateFrom}T00:00:00.000Z`) } : {}),
      ...(params.dateTo ? { lte: new Date(`${params.dateTo}T23:59:59.999Z`) } : {}),
    };
  }
  const rows = await prisma.activityEvent.findMany({ where, select, orderBy: { startAt: "asc" } });
  return rows.map(dto);
}

async function requireEventRow(scope: OrgScope, eventId: string): Promise<Row> {
  const row = await prisma.activityEvent.findFirst({ where: { id: eventId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select });
  if (!row) throw new HttpError("ACTIVITY_EVENT_NOT_FOUND", "Event not found");
  return row;
}

export async function getEvent(scope: OrgScope, eventId: string): Promise<ActivityEventDto> {
  return dto(await requireEventRow(scope, eventId));
}

export async function requireEventInScope(scope: OrgScope, eventId: string): Promise<{ id: string; branchId: string; status: string }> {
  const row = await prisma.activityEvent.findFirst({ where: { id: eventId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true, branchId: true, status: true } });
  if (!row) throw new HttpError("ACTIVITY_EVENT_NOT_FOUND", "Event not found");
  return row;
}

export const createEventSchema = z.object({
  activityId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().optional(),
  location: z.string().trim().max(160).optional(),
});

export async function createEvent(scope: OrgScope, raw: unknown): Promise<ActivityEventDto> {
  const input = parseInput(createEventSchema, raw);
  if (!scope.academicSessionId) throw new HttpError("INVALID_SESSION", "An academic session must be selected");
  const activity = await requireActivityInScope(scope, input.activityId);

  const row = await prisma.activityEvent.create({
    data: {
      tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: activity.branchId, academicSessionId: scope.academicSessionId,
      activityId: input.activityId, title: input.title, description: input.description,
      startAt: new Date(input.startAt), endAt: input.endAt ? new Date(input.endAt) : undefined, location: input.location,
      createdByUserId: scope.actor.id,
    },
    select,
  });
  await recordAudit(prisma, scope, "ACTIVITY_EVENT_CREATED", "ActivityEvent", row.id, { activityId: input.activityId });
  return dto(row);
}

export const updateEventSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().nullable().optional(),
  location: z.string().trim().max(160).nullable().optional(),
});

export async function updateEvent(scope: OrgScope, eventId: string, raw: unknown): Promise<ActivityEventDto> {
  const input = parseInput(updateEventSchema, raw);
  const current = await requireEventRow(scope, eventId);
  if (current.status === "COMPLETED" || current.status === "CANCELLED") throw new HttpError("INVALID_ACTIVITY_EVENT_TRANSITION", "This event is no longer editable");
  const row = await prisma.activityEvent.update({
    where: { id: eventId },
    data: {
      title: input.title, description: input.description,
      startAt: input.startAt ? new Date(input.startAt) : undefined,
      endAt: input.endAt === undefined ? undefined : input.endAt === null ? null : new Date(input.endAt),
      location: input.location,
    },
    select,
  });
  await recordAudit(prisma, scope, "ACTIVITY_EVENT_UPDATED", "ActivityEvent", eventId, {});
  return dto(row);
}

async function transition(scope: OrgScope, eventId: string, from: string[], to: string, action: "ACTIVITY_EVENT_PUBLISHED" | "ACTIVITY_EVENT_COMPLETED" | "ACTIVITY_EVENT_CANCELLED"): Promise<ActivityEventDto> {
  const current = await requireEventRow(scope, eventId);
  if (!from.includes(current.status)) throw new HttpError("INVALID_ACTIVITY_EVENT_TRANSITION", `Cannot transition from ${current.status.toLowerCase()} to ${to.toLowerCase()}`);
  await prisma.$transaction(async (tx) => {
    const updated = await tx.activityEvent.updateMany({ where: { id: eventId, status: { in: from as never[] } }, data: { status: to as never } });
    if (updated.count === 0) throw new HttpError("INVALID_ACTIVITY_EVENT_TRANSITION", "This event's status already changed");
    await recordAudit(tx, scope, action, "ActivityEvent", eventId, {});
  });
  return getEvent(scope, eventId);
}

export const publishEvent = (scope: OrgScope, eventId: string) => transition(scope, eventId, ["DRAFT"], "PUBLISHED", "ACTIVITY_EVENT_PUBLISHED");
export const completeEvent = (scope: OrgScope, eventId: string) => transition(scope, eventId, ["PUBLISHED"], "COMPLETED", "ACTIVITY_EVENT_COMPLETED");
export const cancelEvent = (scope: OrgScope, eventId: string) => transition(scope, eventId, ["DRAFT", "PUBLISHED"], "CANCELLED", "ACTIVITY_EVENT_CANCELLED");
