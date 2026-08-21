// Student Transport Assignments (Phase 9M) — real Student.id, session-scoped
// (academicSessionId), real Route/Stop. Bulk assignment resolves eligible
// students server-side from real Enrollment — a browser-provided student
// list is never trusted as proof of class membership.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { BulkAssignResultDto, StudentTransportAssignmentDto, StudentTransportProfileDto, StudentTransportStatusDto } from "@/lib/api/contracts";
import { resolveTransportBranch } from "./access";
import { getCurrentRouteAssignment } from "./routes";

function requireSession(scope: OrgScope): string {
  if (!scope.academicSessionId) throw new HttpError("INVALID_SESSION", "Select an academic session first");
  return scope.academicSessionId;
}

const statusToUi = (s: string): StudentTransportStatusDto => s.toLowerCase() as StudentTransportStatusDto;
const STATUS_TO_DB: Record<StudentTransportStatusDto, string> = { active: "ACTIVE", suspended: "SUSPENDED", withdrawn: "WITHDRAWN" };

type Row = {
  id: string; studentId: string; routeId: string; pickupStopId: string; dropStopId: string; status: string;
  effectiveFrom: Date; effectiveTo: Date | null; createdAt: Date;
  student: { firstName: string; lastName: string };
  route: { name: string };
  pickupStop: { name: string };
  dropStop: { name: string };
};
const select = {
  id: true, studentId: true, routeId: true, pickupStopId: true, dropStopId: true, status: true, effectiveFrom: true, effectiveTo: true, createdAt: true,
  student: { select: { firstName: true, lastName: true } },
  route: { select: { name: true } },
  pickupStop: { select: { name: true } },
  dropStop: { select: { name: true } },
} satisfies Prisma.StudentTransportAssignmentSelect;

function dto(a: Row): StudentTransportAssignmentDto {
  return {
    id: a.id, studentId: a.studentId, studentName: `${a.student.firstName} ${a.student.lastName ?? ""}`.trim(),
    routeId: a.routeId, routeName: a.route.name, pickupStopId: a.pickupStopId, pickupStopName: a.pickupStop.name,
    dropStopId: a.dropStopId, dropStopName: a.dropStop.name, status: statusToUi(a.status),
    effectiveFrom: a.effectiveFrom.toISOString().slice(0, 10), effectiveTo: a.effectiveTo?.toISOString().slice(0, 10) ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}

export async function listStudentAssignments(scope: OrgScope, params: { status?: string; routeId?: string } = {}): Promise<StudentTransportAssignmentDto[]> {
  const where: Prisma.StudentTransportAssignmentWhereInput = { schoolId: scope.schoolId, academicSessionId: requireSession(scope), ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.status && params.status in STATUS_TO_DB) where.status = STATUS_TO_DB[params.status as StudentTransportStatusDto] as never;
  if (params.routeId) where.routeId = params.routeId;
  const rows = await prisma.studentTransportAssignment.findMany({ where, orderBy: { createdAt: "desc" }, select });
  return rows.map(dto);
}

async function requireRouteStop(scope: OrgScope, routeId: string, stopId: string, label: string): Promise<void> {
  const rs = await prisma.transportRouteStop.findFirst({ where: { routeId, stopId, stop: { schoolId: scope.schoolId } }, select: { id: true } });
  if (!rs) throw new HttpError("VALIDATION_ERROR", `${label} must be a stop on the selected route`);
}

export const assignStudentSchema = z.object({ studentId: z.string().min(1), routeId: z.string().min(1), pickupStopId: z.string().min(1), dropStopId: z.string().min(1).optional() });

export async function assignStudentTransport(scope: OrgScope, raw: unknown): Promise<StudentTransportAssignmentDto> {
  const input = parseInput(assignStudentSchema, raw);
  const sessionId = requireSession(scope);
  const dropStopId = input.dropStopId ?? input.pickupStopId;

  const student = await prisma.student.findFirst({ where: { id: input.studentId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (!student) throw new HttpError("NOT_FOUND", "Student not found");
  const route = await prisma.transportRoute.findFirst({ where: { id: input.routeId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (!route) throw new HttpError("VALIDATION_ERROR", "Route must be real and active");
  await requireRouteStop(scope, input.routeId, input.pickupStopId, "Pickup stop");
  await requireRouteStop(scope, input.routeId, dropStopId, "Drop stop");

  const branchId = await resolveTransportBranch(scope);
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  try {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.studentTransportAssignment.create({
        data: {
          tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, academicSessionId: sessionId,
          studentId: input.studentId, routeId: input.routeId, pickupStopId: input.pickupStopId, dropStopId,
          effectiveFrom: today, createdByUserId: scope.actor.id,
        },
        select,
      });
      await recordAudit(tx, scope, "TRANSPORT_STUDENT_ASSIGNED", "StudentTransportAssignment", row.id, { studentId: input.studentId, routeId: input.routeId });
      return row;
    });
    return dto(created);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new HttpError("CONFLICT", "This student already has an active transport assignment this session");
    }
    throw e;
  }
}

export const bulkAssignSchema = z.object({ classId: z.string().min(1), routeId: z.string().min(1), pickupStopId: z.string().min(1), dropStopId: z.string().min(1).optional() });

/** Resolves eligible students server-side from real Enrollment (never a
 *  browser-provided list). Duplicates (a student already actively assigned)
 *  are silently skipped, not an error — the normal, expected outcome of a
 *  bulk operation re-run over an overlapping class. */
export async function bulkAssignStudentTransport(scope: OrgScope, raw: unknown): Promise<BulkAssignResultDto> {
  const input = parseInput(bulkAssignSchema, raw);
  const sessionId = requireSession(scope);
  const route = await prisma.transportRoute.findFirst({ where: { id: input.routeId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (!route) throw new HttpError("VALIDATION_ERROR", "Route must be real and active");
  const dropStopId = input.dropStopId ?? input.pickupStopId;
  await requireRouteStop(scope, input.routeId, input.pickupStopId, "Pickup stop");
  await requireRouteStop(scope, input.routeId, dropStopId, "Drop stop");

  const enrollments = await prisma.enrollment.findMany({
    where: { classId: input.classId, academicSessionId: sessionId, status: "ENROLLED", schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select: { studentId: true },
  });
  if (enrollments.length === 0) return { assignedCount: 0, skippedCount: 0 };

  const branchId = await resolveTransportBranch(scope);
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  let assignedCount = 0;
  let skippedCount = 0;
  for (const { studentId } of enrollments) {
    try {
      await prisma.$transaction(async (tx) => {
        const row = await tx.studentTransportAssignment.create({
          data: {
            tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, academicSessionId: sessionId,
            studentId, routeId: input.routeId, pickupStopId: input.pickupStopId, dropStopId,
            effectiveFrom: today, createdByUserId: scope.actor.id,
          },
          select: { id: true },
        });
        await recordAudit(tx, scope, "TRANSPORT_STUDENT_ASSIGNED", "StudentTransportAssignment", row.id, { studentId, routeId: input.routeId, bulk: true });
      });
      assignedCount += 1;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        skippedCount += 1;
        continue;
      }
      throw e;
    }
  }
  return { assignedCount, skippedCount };
}

export const withdrawSchema = z.object({ reason: z.string().trim().max(500).optional() });

export async function withdrawStudentTransport(scope: OrgScope, assignmentId: string, raw: unknown = {}): Promise<StudentTransportAssignmentDto> {
  parseInput(withdrawSchema, raw);
  const existing = await prisma.studentTransportAssignment.findFirst({ where: { id: assignmentId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true, status: true } });
  if (!existing) throw new HttpError("NOT_FOUND", "Assignment not found");
  if (existing.status !== "ACTIVE") throw new HttpError("VALIDATION_ERROR", "Only an active assignment can be withdrawn");
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.studentTransportAssignment.update({ where: { id: assignmentId }, data: { status: "WITHDRAWN", effectiveTo: today }, select });
    await recordAudit(tx, scope, "TRANSPORT_STUDENT_UNASSIGNED", "StudentTransportAssignment", assignmentId);
    return row;
  });
  return dto(updated);
}

/** Student 360 Transport tab — the student's current active assignment plus
 *  the route's current vehicle/driver/attendant, if determinable. Never a
 *  live location. */
export async function getStudentTransportProfile(scope: OrgScope, studentId: string): Promise<StudentTransportProfileDto> {
  const sessionId = requireSession(scope);
  const row = await prisma.studentTransportAssignment.findFirst({
    where: { studentId, schoolId: scope.schoolId, academicSessionId: sessionId, status: "ACTIVE" },
    select,
  });
  if (!row) return { assignment: null, vehicle: null, driverName: null, attendantName: null };
  const assignment = dto(row);
  const routeAssignment = await getCurrentRouteAssignment(scope, row.routeId);
  return {
    assignment,
    vehicle: routeAssignment ? { id: routeAssignment.vehicleId, registrationNumber: routeAssignment.vehicleRegistration } : null,
    driverName: routeAssignment?.driverName ?? null,
    attendantName: routeAssignment?.attendantName ?? null,
  };
}
