// Transport Routes (Phase 9M) — real Route + Route↔Stop ordering +
// effective-dated Route↔Vehicle↔Staff(driver/attendant) assignment. Drivers/
// attendants are always real Staff.id — never a parallel identity.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type {
  CurrentTransportStaffDto,
  TransportRouteAssignmentDto,
  TransportRouteDirectionDto,
  TransportRouteListItemDto,
  TransportRouteStatusDto,
  TransportRouteStopDto,
  TransportShiftDto,
} from "@/lib/api/contracts";
import { displayName, resolveTransportBranch } from "./access";

const SHIFT_TO_DB: Record<TransportShiftDto, string> = { morning: "MORNING", afternoon: "AFTERNOON", evening: "EVENING", both: "BOTH" };
const shiftToUi = (s: string): TransportShiftDto => s.toLowerCase() as TransportShiftDto;
const DIRECTION_TO_DB: Record<TransportRouteDirectionDto, string> = { pickup: "PICKUP", drop: "DROP", both: "BOTH" };
const directionToUi = (d: string): TransportRouteDirectionDto => d.toLowerCase() as TransportRouteDirectionDto;
const statusToUi = (s: string): TransportRouteStatusDto => s.toLowerCase() as TransportRouteStatusDto;
const STATUS_TO_DB: Record<TransportRouteStatusDto, string> = { draft: "DRAFT", active: "ACTIVE", paused: "PAUSED", archived: "ARCHIVED" };

const shiftEnum = z.enum(["morning", "afternoon", "evening", "both"]);
const directionEnum = z.enum(["pickup", "drop", "both"]);

export const createRouteSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(24),
  shift: shiftEnum.optional(),
  direction: directionEnum.optional(),
  capacity: z.number().int().min(1).max(200).optional(),
  notes: z.string().trim().max(500).optional(),
});
export const updateRouteSchema = createRouteSchema.partial().extend({ status: z.enum(["draft", "active", "paused", "archived"]).optional() });

type RouteRow = {
  id: string; name: string; code: string; shift: string; direction: string; capacity: number | null; status: string; notes: string | null;
  createdAt: Date; updatedAt: Date;
  assignments: { vehicle: { id: string; registrationNumber: string }; driver: { id: string; firstName: string; lastName: string | null; displayName: string | null } | null; attendant: { id: string; firstName: string; lastName: string | null; displayName: string | null } | null }[];
  _count: { studentAssignments: number };
};
const routeSelect = {
  id: true, name: true, code: true, shift: true, direction: true, capacity: true, status: true, notes: true, createdAt: true, updatedAt: true,
  assignments: {
    where: { status: "ACTIVE" }, take: 1,
    select: {
      vehicle: { select: { id: true, registrationNumber: true } },
      driver: { select: { id: true, firstName: true, lastName: true, displayName: true } },
      attendant: { select: { id: true, firstName: true, lastName: true, displayName: true } },
    },
  },
  _count: { select: { studentAssignments: { where: { status: "ACTIVE" } } } },
} satisfies Prisma.TransportRouteSelect;

function routeDto(r: RouteRow): TransportRouteListItemDto {
  const active = r.assignments[0];
  return {
    id: r.id, name: r.name, code: r.code, shift: shiftToUi(r.shift), direction: directionToUi(r.direction),
    capacity: r.capacity, status: statusToUi(r.status), notes: r.notes,
    vehicle: active ? { id: active.vehicle.id, registrationNumber: active.vehicle.registrationNumber } : null,
    driver: active?.driver ? { id: active.driver.id, name: displayName(active.driver) } : null,
    attendant: active?.attendant ? { id: active.attendant.id, name: displayName(active.attendant) } : null,
    studentCount: r._count.studentAssignments,
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  };
}

export async function requireRouteInScope(scope: OrgScope, routeId: string): Promise<{ id: string; branchId: string }> {
  const r = await prisma.transportRoute.findFirst({ where: { id: routeId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true, branchId: true } });
  if (!r) throw new HttpError("NOT_FOUND", "Route not found");
  return r;
}

export async function listRoutes(scope: OrgScope, params: { status?: string; search?: string } = {}): Promise<TransportRouteListItemDto[]> {
  const where: Prisma.TransportRouteWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.status && params.status in STATUS_TO_DB) where.status = STATUS_TO_DB[params.status as TransportRouteStatusDto] as never;
  if (params.search?.trim()) {
    const q = params.search.trim();
    where.OR = [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }];
  }
  const rows = await prisma.transportRoute.findMany({ where, orderBy: { code: "asc" }, select: routeSelect });
  return rows.map(routeDto);
}

export async function getRoute(scope: OrgScope, routeId: string): Promise<TransportRouteListItemDto> {
  await requireRouteInScope(scope, routeId);
  const r = await prisma.transportRoute.findUniqueOrThrow({ where: { id: routeId }, select: routeSelect });
  return routeDto(r);
}

export async function createRoute(scope: OrgScope, raw: unknown): Promise<TransportRouteListItemDto> {
  const input = parseInput(createRouteSchema, raw);
  const branchId = await resolveTransportBranch(scope);
  try {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.transportRoute.create({
        data: {
          tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, name: input.name, code: input.code,
          shift: input.shift ? (SHIFT_TO_DB[input.shift] as never) : undefined,
          direction: input.direction ? (DIRECTION_TO_DB[input.direction] as never) : undefined,
          capacity: input.capacity, notes: input.notes,
        },
        select: routeSelect,
      });
      await recordAudit(tx, scope, "TRANSPORT_ROUTE_CREATED", "TransportRoute", row.id, { code: row.code });
      return row;
    });
    return routeDto(created);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError("CONFLICT", "A route with this code already exists");
    throw e;
  }
}

export async function updateRoute(scope: OrgScope, routeId: string, raw: unknown): Promise<TransportRouteListItemDto> {
  const input = parseInput(updateRouteSchema, raw);
  await requireRouteInScope(scope, routeId);
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.transportRoute.update({
        where: { id: routeId },
        data: {
          name: input.name, code: input.code,
          shift: input.shift ? (SHIFT_TO_DB[input.shift] as never) : undefined,
          direction: input.direction ? (DIRECTION_TO_DB[input.direction] as never) : undefined,
          capacity: input.capacity, notes: input.notes,
          status: input.status ? (STATUS_TO_DB[input.status] as never) : undefined,
        },
        select: routeSelect,
      });
      await recordAudit(tx, scope, "TRANSPORT_ROUTE_UPDATED", "TransportRoute", routeId);
      return row;
    });
    return routeDto(updated);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError("CONFLICT", "A route with this code already exists");
    throw e;
  }
}

// ── Route stops (ordering) ──────────────────────────────────────────────────

export async function listRouteStops(scope: OrgScope, routeId: string): Promise<TransportRouteStopDto[]> {
  await requireRouteInScope(scope, routeId);
  const rows = await prisma.transportRouteStop.findMany({
    where: { routeId }, orderBy: { sequence: "asc" },
    select: { id: true, stopId: true, sequence: true, pickupTime: true, dropTime: true, stop: { select: { name: true, code: true } } },
  });
  return rows.map((r) => ({ id: r.id, stopId: r.stopId, stopName: r.stop.name, stopCode: r.stop.code, sequence: r.sequence, pickupTime: r.pickupTime, dropTime: r.dropTime }));
}

const setRouteStopsSchema = z.object({
  stops: z.array(z.object({ stopId: z.string().min(1), sequence: z.number().int().min(0), pickupTime: z.string().regex(/^\d{2}:\d{2}$/).optional(), dropTime: z.string().regex(/^\d{2}:\d{2}$/).optional() })).max(100),
});

/** Atomic full replace of a route's stop list — the caller sends the whole
 *  ordered set (matches the existing route-builder UI's "save the whole
 *  sequence" flow, not per-row drag events). Every stop must be real and in
 *  scope; deleteMany+createMany inside one transaction is safe here because
 *  sequence has no DB-unique constraint (see the schema doc comment). */
export async function setRouteStops(scope: OrgScope, routeId: string, raw: unknown): Promise<TransportRouteStopDto[]> {
  const input = parseInput(setRouteStopsSchema, raw);
  await requireRouteInScope(scope, routeId);
  const stopIds = input.stops.map((s) => s.stopId);
  if (new Set(stopIds).size !== stopIds.length) throw new HttpError("VALIDATION_ERROR", "A stop cannot appear twice on the same route");
  if (stopIds.length > 0) {
    const validCount = await prisma.transportStop.count({ where: { id: { in: stopIds }, schoolId: scope.schoolId } });
    if (validCount !== stopIds.length) throw new HttpError("VALIDATION_ERROR", "One or more stops are invalid");
  }
  await prisma.$transaction(async (tx) => {
    await tx.transportRouteStop.deleteMany({ where: { routeId } });
    if (input.stops.length > 0) {
      await tx.transportRouteStop.createMany({
        data: input.stops.map((s) => ({ tenantId: scope.tenantId, routeId, stopId: s.stopId, sequence: s.sequence, pickupTime: s.pickupTime, dropTime: s.dropTime })),
      });
    }
    await recordAudit(tx, scope, "TRANSPORT_ROUTE_UPDATED", "TransportRoute", routeId, { stopCount: input.stops.length });
  });
  return listRouteStops(scope, routeId);
}

// ── Route ↔ vehicle/driver/attendant assignment (effective-dated) ──────────

function assignmentDto(a: {
  id: string; routeId: string; vehicleId: string; driverStaffId: string | null; attendantStaffId: string | null;
  status: string; effectiveFrom: Date; effectiveTo: Date | null;
  vehicle: { registrationNumber: string }; driver: { firstName: string; lastName: string | null; displayName: string | null } | null; attendant: { firstName: string; lastName: string | null; displayName: string | null } | null;
}): TransportRouteAssignmentDto {
  return {
    id: a.id, routeId: a.routeId, vehicleId: a.vehicleId, vehicleRegistration: a.vehicle.registrationNumber,
    driverStaffId: a.driverStaffId, driverName: a.driver ? displayName(a.driver) : null,
    attendantStaffId: a.attendantStaffId, attendantName: a.attendant ? displayName(a.attendant) : null,
    status: a.status.toLowerCase() as "active" | "ended",
    effectiveFrom: a.effectiveFrom.toISOString().slice(0, 10), effectiveTo: a.effectiveTo?.toISOString().slice(0, 10) ?? null,
  };
}
const assignmentSelect = {
  id: true, routeId: true, vehicleId: true, driverStaffId: true, attendantStaffId: true, status: true, effectiveFrom: true, effectiveTo: true,
  vehicle: { select: { registrationNumber: true } },
  driver: { select: { firstName: true, lastName: true, displayName: true } },
  attendant: { select: { firstName: true, lastName: true, displayName: true } },
} satisfies Prisma.TransportRouteAssignmentSelect;

export async function getCurrentRouteAssignment(scope: OrgScope, routeId: string): Promise<TransportRouteAssignmentDto | null> {
  await requireRouteInScope(scope, routeId);
  const row = await prisma.transportRouteAssignment.findFirst({ where: { routeId, status: "ACTIVE" }, select: assignmentSelect });
  return row ? assignmentDto(row) : null;
}

export async function listRouteAssignmentHistory(scope: OrgScope, routeId: string): Promise<TransportRouteAssignmentDto[]> {
  await requireRouteInScope(scope, routeId);
  const rows = await prisma.transportRouteAssignment.findMany({ where: { routeId }, orderBy: { effectiveFrom: "desc" }, select: assignmentSelect });
  return rows.map(assignmentDto);
}

const setAssignmentSchema = z.object({ vehicleId: z.string().min(1), driverStaffId: z.string().min(1).optional(), attendantStaffId: z.string().min(1).optional() });

async function requireActiveStaffInScope(scope: OrgScope, staffId: string, role: string): Promise<void> {
  const s = await prisma.staff.findFirst({ where: { id: staffId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (!s) throw new HttpError("VALIDATION_ERROR", `${role} must be a real, active staff member in this school`);
}

/** Real Staff currently on active duty as a driver/attendant somewhere —
 *  derived from ACTIVE TransportRouteAssignment rows, never a parallel
 *  Driver/Attendant identity. Assigning a NEW driver/attendant uses the
 *  regular Staff directory (any real, active Staff), not this list. */
export async function listCurrentTransportStaff(scope: OrgScope, role: "driver" | "attendant"): Promise<CurrentTransportStaffDto[]> {
  const rows = await prisma.transportRouteAssignment.findMany({
    where: { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}), status: "ACTIVE", ...(role === "driver" ? { driverStaffId: { not: null } } : { attendantStaffId: { not: null } }) },
    select: {
      routeId: true, route: { select: { name: true } },
      driver: role === "driver" ? { select: { id: true, firstName: true, lastName: true, displayName: true } } : false,
      attendant: role === "attendant" ? { select: { id: true, firstName: true, lastName: true, displayName: true } } : false,
    },
  });
  return rows
    .map((r) => {
      const staff = role === "driver" ? r.driver : r.attendant;
      if (!staff) return null;
      return { staffId: staff.id, staffName: displayName(staff), routeId: r.routeId, routeName: r.route.name };
    })
    .filter((r): r is CurrentTransportStaffDto => r !== null);
}

/**
 * Ends the route's current ACTIVE assignment (if any) and starts a new one,
 * atomically. Concurrency-safe: the partial unique index
 * `transport_route_assignments_active_uq` allows at most one ACTIVE row per
 * route — a concurrent race that both try to insert a new ACTIVE row will
 * have exactly one winner; the loser's insert raises P2002.
 */
export async function setRouteAssignment(scope: OrgScope, routeId: string, raw: unknown): Promise<TransportRouteAssignmentDto> {
  const input = parseInput(setAssignmentSchema, raw);
  await requireRouteInScope(scope, routeId);
  const vehicle = await prisma.transportVehicle.findFirst({ where: { id: input.vehicleId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (!vehicle) throw new HttpError("VALIDATION_ERROR", "Vehicle must be real, active, and in this school");
  if (input.driverStaffId) await requireActiveStaffInScope(scope, input.driverStaffId, "Driver");
  if (input.attendantStaffId) await requireActiveStaffInScope(scope, input.attendantStaffId, "Attendant");

  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  try {
    const created = await prisma.$transaction(async (tx) => {
      const ended = await tx.transportRouteAssignment.updateMany({ where: { routeId, status: "ACTIVE" }, data: { status: "ENDED", effectiveTo: today } });
      if (ended.count > 0) await recordAudit(tx, scope, "TRANSPORT_ROUTE_ASSIGNMENT_ENDED", "TransportRoute", routeId);
      const branchId = await resolveTransportBranch(scope);
      const row = await tx.transportRouteAssignment.create({
        data: {
          tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, routeId, vehicleId: input.vehicleId,
          driverStaffId: input.driverStaffId, attendantStaffId: input.attendantStaffId,
          effectiveFrom: today, createdByUserId: scope.actor.id,
        },
        select: assignmentSelect,
      });
      await recordAudit(tx, scope, "TRANSPORT_ROUTE_ASSIGNMENT_CREATED", "TransportRoute", routeId, { vehicleId: input.vehicleId });
      return row;
    });
    return assignmentDto(created);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new HttpError("CONFLICT", "This route already has an active assignment — retry");
    }
    throw e;
  }
}
