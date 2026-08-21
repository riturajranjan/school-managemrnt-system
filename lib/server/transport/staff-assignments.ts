// Staff Transport Assignments (Phase 9M) — teachers/staff riding the same
// real routes, via real Staff.id. Not session-scoped (Staff has no
// Enrollment/session concept) — at most one ACTIVE assignment per staff ever.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { displayName as staffDisplayName, resolveTransportBranch } from "./access";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { StaffTransportAssignmentDto, StudentTransportStatusDto } from "@/lib/api/contracts";

const statusToUi = (s: string): StudentTransportStatusDto => s.toLowerCase() as StudentTransportStatusDto;

type Row = {
  id: string; staffId: string; routeId: string; pickupStopId: string; status: string; effectiveFrom: Date; createdAt: Date;
  staff: { firstName: string; lastName: string | null; displayName: string | null };
  route: { name: string };
  stop: { name: string };
};
const select = {
  id: true, staffId: true, routeId: true, pickupStopId: true, status: true, effectiveFrom: true, createdAt: true,
  staff: { select: { firstName: true, lastName: true, displayName: true } },
  route: { select: { name: true } },
  stop: { select: { name: true } },
} satisfies Prisma.StaffTransportAssignmentSelect;

function dto(a: Row): StaffTransportAssignmentDto {
  return {
    id: a.id, staffId: a.staffId, staffName: staffDisplayName(a.staff), routeId: a.routeId, routeName: a.route.name,
    pickupStopId: a.pickupStopId, pickupStopName: a.stop.name, status: statusToUi(a.status),
    effectiveFrom: a.effectiveFrom.toISOString().slice(0, 10), createdAt: a.createdAt.toISOString(),
  };
}

export async function listStaffAssignments(scope: OrgScope, params: { status?: string } = {}): Promise<StaffTransportAssignmentDto[]> {
  const where: Prisma.StaffTransportAssignmentWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.status) where.status = params.status.toUpperCase() as never;
  const rows = await prisma.staffTransportAssignment.findMany({ where, orderBy: { createdAt: "desc" }, select });
  return rows.map(dto);
}

export const assignStaffSchema = z.object({ staffId: z.string().min(1), routeId: z.string().min(1), pickupStopId: z.string().min(1) });

export async function assignStaffTransport(scope: OrgScope, raw: unknown): Promise<StaffTransportAssignmentDto> {
  const input = parseInput(assignStaffSchema, raw);
  const staff = await prisma.staff.findFirst({ where: { id: input.staffId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (!staff) throw new HttpError("NOT_FOUND", "Staff member not found");
  const route = await prisma.transportRoute.findFirst({ where: { id: input.routeId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (!route) throw new HttpError("VALIDATION_ERROR", "Route must be real and active");
  const stop = await prisma.transportRouteStop.findFirst({ where: { routeId: input.routeId, stopId: input.pickupStopId, stop: { schoolId: scope.schoolId } }, select: { id: true } });
  if (!stop) throw new HttpError("VALIDATION_ERROR", "Stop must be on the selected route");

  const branchId = await resolveTransportBranch(scope);
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  try {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.staffTransportAssignment.create({
        data: { tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, staffId: input.staffId, routeId: input.routeId, pickupStopId: input.pickupStopId, effectiveFrom: today, createdByUserId: scope.actor.id },
        select,
      });
      await recordAudit(tx, scope, "TRANSPORT_STAFF_ASSIGNED", "StaffTransportAssignment", row.id, { staffId: input.staffId, routeId: input.routeId });
      return row;
    });
    return dto(created);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError("CONFLICT", "This staff member already has an active transport assignment");
    throw e;
  }
}

export async function withdrawStaffTransport(scope: OrgScope, assignmentId: string): Promise<StaffTransportAssignmentDto> {
  const existing = await prisma.staffTransportAssignment.findFirst({ where: { id: assignmentId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true, status: true } });
  if (!existing) throw new HttpError("NOT_FOUND", "Assignment not found");
  if (existing.status !== "ACTIVE") throw new HttpError("VALIDATION_ERROR", "Only an active assignment can be withdrawn");
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.staffTransportAssignment.update({ where: { id: assignmentId }, data: { status: "WITHDRAWN" }, select });
    await recordAudit(tx, scope, "TRANSPORT_STAFF_UNASSIGNED", "StaffTransportAssignment", assignmentId);
    return row;
  });
  return dto(updated);
}
