// Transport Trips (Phase 9M) — real daily trip operations. vehicleId/
// driverStaffId/attendantStaffId are snapshotted from the route's effective
// TransportRouteAssignment AT CREATION TIME (never re-read live), and the
// stop timeline + student roster are seeded from real TransportRouteStop /
// active StudentTransportAssignment rows at creation — so a later route/
// crew/roster edit never rewrites a past trip's own history. Server-
// authoritative timestamps throughout; no browser-provided time is ever
// trusted. Self-service (an assigned driver/attendant acting on their own
// trip) is identity-based (Staff.userId), never a client-supplied staffId.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { getCurrentStaffProfile } from "@/lib/server/staff/service";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type {
  TransportBoardingStatusDto,
  TransportDropStatusDto,
  TransportTripDetailDto,
  TransportTripListItemDto,
  TransportTripStatusDto,
  TransportTripTypeDto,
} from "@/lib/api/contracts";
import { displayName, resolveTransportBranch } from "./access";

const TYPE_TO_DB: Record<TransportTripTypeDto, string> = { pickup: "PICKUP", drop: "DROP" };
const typeToUi = (t: string): TransportTripTypeDto => t.toLowerCase() as TransportTripTypeDto;
const statusToUi = (s: string): TransportTripStatusDto => (s === "IN_PROGRESS" ? "in-progress" : (s.toLowerCase() as TransportTripStatusDto));
const dateToUi = (d: Date) => d.toISOString().slice(0, 10);

type ListRow = {
  id: string; routeId: string; date: Date; type: string; status: string;
  createdAt: Date;
  route: { name: string };
  vehicle: { registrationNumber: string } | null;
  driver: { firstName: string; lastName: string | null; displayName: string | null } | null;
  _count: { tripStudents: number };
};
const listSelect = {
  id: true, routeId: true, date: true, type: true, status: true, createdAt: true,
  route: { select: { name: true } },
  vehicle: { select: { registrationNumber: true } },
  driver: { select: { firstName: true, lastName: true, displayName: true } },
  _count: { select: { tripStudents: true } },
} satisfies Prisma.TransportTripSelect;

async function boardedCounts(tripIds: string[]): Promise<Map<string, number>> {
  if (tripIds.length === 0) return new Map();
  const rows = await prisma.transportTripStudent.groupBy({ by: ["tripId"], where: { tripId: { in: tripIds }, boardingStatus: "BOARDED" }, _count: { _all: true } });
  return new Map(rows.map((r) => [r.tripId, r._count._all]));
}

async function listItemDtos(rows: ListRow[]): Promise<TransportTripListItemDto[]> {
  const boarded = await boardedCounts(rows.map((r) => r.id));
  return rows.map((t) => ({
    id: t.id, routeId: t.routeId, routeName: t.route.name, date: dateToUi(t.date), type: typeToUi(t.type), status: statusToUi(t.status),
    vehicleRegistration: t.vehicle?.registrationNumber ?? null, driverName: t.driver ? displayName(t.driver) : null,
    studentsBoarded: boarded.get(t.id) ?? 0, studentsExpected: t._count.tripStudents,
    createdAt: t.createdAt.toISOString(),
  }));
}

export async function listTrips(scope: OrgScope, params: { status?: string; routeId?: string; vehicleId?: string; date?: string } = {}): Promise<TransportTripListItemDto[]> {
  const where: Prisma.TransportTripWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.status) where.status = params.status.toUpperCase().replace("-", "_") as never;
  if (params.routeId) where.routeId = params.routeId;
  if (params.vehicleId) where.vehicleId = params.vehicleId;
  if (params.date) where.date = new Date(`${params.date}T00:00:00.000Z`);
  const rows = await prisma.transportTrip.findMany({ where, orderBy: [{ date: "desc" }, { createdAt: "desc" }], select: listSelect });
  return listItemDtos(rows);
}

/** The authenticated driver/attendant's own trips — resolved via
 *  Staff.userId, never a client-supplied staffId. */
export async function listMyTrips(scope: OrgScope): Promise<TransportTripListItemDto[]> {
  const staff = await getCurrentStaffProfile(scope);
  if (!staff) return [];
  const rows = await prisma.transportTrip.findMany({
    where: { schoolId: scope.schoolId, OR: [{ driverStaffId: staff.id }, { attendantStaffId: staff.id }] },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }], select: listSelect,
  });
  return listItemDtos(rows);
}

const detailSelect = {
  ...listSelect,
  vehicleId: true, driverStaffId: true, attendantStaffId: true, startedAt: true, completedAt: true,
  attendant: { select: { firstName: true, lastName: true, displayName: true } },
  stops: { orderBy: { sequence: "asc" as const }, select: { id: true, stopId: true, sequence: true, status: true, arrivedAt: true, departedAt: true, stop: { select: { name: true } } } },
  tripStudents: {
    select: { id: true, studentId: true, stopId: true, boardingStatus: true, dropStatus: true, boardedAt: true, droppedAt: true, student: { select: { firstName: true, lastName: true } }, stop: { select: { name: true } } },
  },
} satisfies Prisma.TransportTripSelect;
type DetailRow = Prisma.TransportTripGetPayload<{ select: typeof detailSelect }>;

async function detailDto(t: DetailRow): Promise<TransportTripDetailDto> {
  const [list] = await listItemDtos([t]);
  return {
    ...list,
    vehicleId: t.vehicleId, driverStaffId: t.driverStaffId, attendantStaffId: t.attendantStaffId,
    attendantName: t.attendant ? displayName(t.attendant) : null,
    startedAt: t.startedAt?.toISOString() ?? null, completedAt: t.completedAt?.toISOString() ?? null,
    stops: t.stops.map((s) => ({ id: s.id, stopId: s.stopId, stopName: s.stop.name, sequence: s.sequence, status: s.status.toLowerCase() as "pending" | "arrived" | "departed", arrivedAt: s.arrivedAt?.toISOString() ?? null, departedAt: s.departedAt?.toISOString() ?? null })),
    students: t.tripStudents.map((ts) => ({
      id: ts.id, studentId: ts.studentId, studentName: `${ts.student.firstName} ${ts.student.lastName ?? ""}`.trim(), stopId: ts.stopId, stopName: ts.stop.name,
      boardingStatus: ts.boardingStatus.toLowerCase() as TransportBoardingStatusDto, dropStatus: ts.dropStatus.toLowerCase() as TransportDropStatusDto,
      boardedAt: ts.boardedAt?.toISOString() ?? null, droppedAt: ts.droppedAt?.toISOString() ?? null,
    })),
  };
}

async function requireTripInScope(scope: OrgScope, tripId: string): Promise<DetailRow> {
  const t = await prisma.transportTrip.findFirst({ where: { id: tripId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: detailSelect });
  if (!t) throw new HttpError("NOT_FOUND", "Trip not found");
  return t;
}

/** True if the actor is privileged (transport.view/manage, per the caller's
 *  flag) OR is this trip's own assigned driver/attendant (identity-based,
 *  via Staff.userId) — reused for both reading and operating on a trip. */
async function assertCanAccess(scope: OrgScope, trip: { driverStaffId: string | null; attendantStaffId: string | null }, privileged: boolean): Promise<void> {
  if (privileged) return;
  const staff = await getCurrentStaffProfile(scope);
  if (staff && (staff.id === trip.driverStaffId || staff.id === trip.attendantStaffId)) return;
  throw new HttpError("NOT_FOUND", "Trip not found");
}

/** `canView` lets a non-privileged caller through only when they're the
 *  trip's own assigned driver/attendant — a 404 (not 403) for anyone else,
 *  matching the no-existence-leak pattern used elsewhere in this codebase. */
export async function getTrip(scope: OrgScope, tripId: string, canView: boolean = true): Promise<TransportTripDetailDto> {
  const t = await requireTripInScope(scope, tripId);
  await assertCanAccess(scope, t, canView);
  return detailDto(t);
}

export const createTripSchema = z.object({ routeId: z.string().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), type: z.enum(["pickup", "drop"]).default("pickup") });

/**
 * Snapshots the route's effective crew/vehicle and seeds the stop timeline +
 * student roster from real rows — see the module doc comment. One trip per
 * (route, date, type) is DB-enforced (@@unique) — the real concurrency
 * guarantee against a duplicate trip being created twice.
 */
export async function createTrip(scope: OrgScope, raw: unknown): Promise<TransportTripDetailDto> {
  const input = parseInput(createTripSchema, raw);
  const route = await prisma.transportRoute.findFirst({ where: { id: input.routeId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (!route) throw new HttpError("VALIDATION_ERROR", "Route must be real and active");
  const assignment = await prisma.transportRouteAssignment.findFirst({ where: { routeId: input.routeId, status: "ACTIVE" }, select: { vehicleId: true, driverStaffId: true, attendantStaffId: true } });
  if (!assignment) throw new HttpError("VALIDATION_ERROR", "This route has no vehicle assigned yet");

  const [routeStops, activeAssignments] = await Promise.all([
    prisma.transportRouteStop.findMany({ where: { routeId: input.routeId }, orderBy: { sequence: "asc" }, select: { stopId: true, sequence: true } }),
    prisma.studentTransportAssignment.findMany({ where: { routeId: input.routeId, status: "ACTIVE" }, select: { id: true, studentId: true, pickupStopId: true, dropStopId: true } }),
  ]);

  const branchId = await resolveTransportBranch(scope);
  const date = new Date(`${input.date}T00:00:00.000Z`);
  try {
    const created = await prisma.$transaction(async (tx) => {
      const trip = await tx.transportTrip.create({
        data: {
          tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, routeId: input.routeId,
          vehicleId: assignment.vehicleId, driverStaffId: assignment.driverStaffId, attendantStaffId: assignment.attendantStaffId,
          date, type: TYPE_TO_DB[input.type] as never, createdByUserId: scope.actor.id,
        },
        select: { id: true },
      });
      if (routeStops.length > 0) {
        await tx.transportTripStop.createMany({ data: routeStops.map((rs) => ({ tripId: trip.id, stopId: rs.stopId, sequence: rs.sequence })) });
      }
      if (activeAssignments.length > 0) {
        await tx.transportTripStudent.createMany({
          data: activeAssignments.map((a) => ({ tripId: trip.id, studentId: a.studentId, assignmentId: a.id, stopId: input.type === "drop" ? a.dropStopId : a.pickupStopId })),
        });
      }
      await recordAudit(tx, scope, "TRANSPORT_TRIP_CREATED", "TransportTrip", trip.id, { routeId: input.routeId, date: input.date });
      return trip.id;
    });
    return getTrip(scope, created);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new HttpError("CONFLICT", "A trip already exists for this route, date and type");
    }
    throw e;
  }
}

/** Concurrency-safe transition: the WHERE guard on current status means a
 *  losing concurrent request affects zero rows and gets a clean typed error,
 *  never a double-transition. */
async function transition(scope: OrgScope, tripId: string, fromStatuses: string[], toStatus: string, timestampField: "startedAt" | "completedAt" | "cancelledAt", auditAction: "TRANSPORT_TRIP_STARTED" | "TRANSPORT_TRIP_COMPLETED" | "TRANSPORT_TRIP_CANCELLED"): Promise<void> {
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.transportTrip.updateMany({ where: { id: tripId, status: { in: fromStatuses as never[] } }, data: { status: toStatus as never, [timestampField]: now } });
    if (updated.count > 0) await recordAudit(tx, scope, auditAction, "TransportTrip", tripId);
    return updated.count;
  });
  if (result === 0) {
    const current = await prisma.transportTrip.findUnique({ where: { id: tripId }, select: { status: true } });
    throw new HttpError("INVALID_STATUS_TRANSITION", `Trip is ${current?.status.toLowerCase().replace("_", "-") ?? "unknown"} — cannot transition to ${toStatus.toLowerCase()}`);
  }
}

export async function startTrip(scope: OrgScope, tripId: string, canManage: boolean): Promise<TransportTripDetailDto> {
  const trip = await requireTripInScope(scope, tripId);
  await assertCanAccess(scope, trip, canManage);
  await transition(scope, tripId, ["SCHEDULED"], "IN_PROGRESS", "startedAt", "TRANSPORT_TRIP_STARTED");
  return getTrip(scope, tripId);
}

export async function completeTrip(scope: OrgScope, tripId: string, canManage: boolean): Promise<TransportTripDetailDto> {
  const trip = await requireTripInScope(scope, tripId);
  await assertCanAccess(scope, trip, canManage);
  await transition(scope, tripId, ["IN_PROGRESS"], "COMPLETED", "completedAt", "TRANSPORT_TRIP_COMPLETED");
  return getTrip(scope, tripId);
}

export async function cancelTrip(scope: OrgScope, tripId: string, canManage: boolean): Promise<TransportTripDetailDto> {
  const trip = await requireTripInScope(scope, tripId);
  await assertCanAccess(scope, trip, canManage);
  await transition(scope, tripId, ["SCHEDULED", "IN_PROGRESS"], "CANCELLED", "cancelledAt", "TRANSPORT_TRIP_CANCELLED");
  return getTrip(scope, tripId);
}

// ── Stop timeline ────────────────────────────────────────────────────────

export async function markTripStopStatus(scope: OrgScope, tripId: string, tripStopId: string, status: "arrived" | "departed", canManage: boolean): Promise<TransportTripDetailDto> {
  const trip = await requireTripInScope(scope, tripId);
  await assertCanAccess(scope, trip, canManage);
  const stop = trip.stops.find((s) => s.id === tripStopId);
  if (!stop) throw new HttpError("NOT_FOUND", "Trip stop not found");
  const now = new Date();
  await prisma.transportTripStop.update({ where: { id: tripStopId }, data: { status: status.toUpperCase() as never, ...(status === "arrived" ? { arrivedAt: now } : { departedAt: now }) } });
  return getTrip(scope, tripId);
}

// ── Boarding / drop ──────────────────────────────────────────────────────

export const markBoardingSchema = z.object({ status: z.enum(["expected", "boarded", "absent"]) });
export const markDropSchema = z.object({ status: z.enum(["onboard", "dropped"]) });

export async function markStudentBoarding(scope: OrgScope, tripId: string, tripStudentId: string, raw: unknown, canManage: boolean): Promise<TransportTripDetailDto> {
  const input = parseInput(markBoardingSchema, raw);
  const trip = await requireTripInScope(scope, tripId);
  await assertCanAccess(scope, trip, canManage);
  const record = trip.tripStudents.find((s) => s.id === tripStudentId);
  if (!record) throw new HttpError("NOT_FOUND", "Trip student record not found");
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.transportTripStudent.update({
      where: { id: tripStudentId },
      data: { boardingStatus: input.status.toUpperCase() as never, boardedAt: input.status === "boarded" ? now : record.boardedAt, markedByUserId: scope.actor.id },
    });
    if (input.status === "boarded") await recordAudit(tx, scope, "TRANSPORT_STUDENT_BOARDED", "TransportTripStudent", tripStudentId, { tripId });
  });
  return getTrip(scope, tripId);
}

export async function markStudentDrop(scope: OrgScope, tripId: string, tripStudentId: string, raw: unknown, canManage: boolean): Promise<TransportTripDetailDto> {
  const input = parseInput(markDropSchema, raw);
  const trip = await requireTripInScope(scope, tripId);
  await assertCanAccess(scope, trip, canManage);
  const record = trip.tripStudents.find((s) => s.id === tripStudentId);
  if (!record) throw new HttpError("NOT_FOUND", "Trip student record not found");
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.transportTripStudent.update({
      where: { id: tripStudentId },
      data: { dropStatus: input.status.toUpperCase() as never, droppedAt: input.status === "dropped" ? now : record.droppedAt, markedByUserId: scope.actor.id },
    });
    if (input.status === "dropped") await recordAudit(tx, scope, "TRANSPORT_STUDENT_DROPPED", "TransportTripStudent", tripStudentId, { tripId });
  });
  return getTrip(scope, tripId);
}
