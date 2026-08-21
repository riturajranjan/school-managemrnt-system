// Transport Stops (Phase 9M) — real, PostgreSQL-backed. No lat/long/geofence:
// the old mock UI silently hardcoded fake coordinates on every create — there
// was never a genuine manual-entry field, so none is modelled here.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { TransportStopDto, TransportStopStatusDto } from "@/lib/api/contracts";
import { resolveTransportBranch } from "./access";

const statusToUi = (s: string): TransportStopStatusDto => s.toLowerCase() as TransportStopStatusDto;
const STATUS_TO_DB: Record<TransportStopStatusDto, string> = { active: "ACTIVE", temporary: "TEMPORARY", unsafe: "UNSAFE", inactive: "INACTIVE" };

export const createStopSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(24),
  address: z.string().trim().min(1).max(300),
  landmark: z.string().trim().max(120).optional(),
});

type Row = { id: string; name: string; code: string; address: string; landmark: string | null; status: string; safetyNotes: string | null; createdAt: Date; updatedAt: Date; _count: { routeStops: number; pickupAssignments: number } };
const select = {
  id: true, name: true, code: true, address: true, landmark: true, status: true, safetyNotes: true, createdAt: true, updatedAt: true,
  _count: { select: { routeStops: true, pickupAssignments: { where: { status: "ACTIVE" } } } },
} satisfies Prisma.TransportStopSelect;

function dto(s: Row): TransportStopDto {
  return {
    id: s.id, name: s.name, code: s.code, address: s.address, landmark: s.landmark,
    status: statusToUi(s.status), safetyNotes: s.safetyNotes,
    routeCount: s._count.routeStops, studentCount: s._count.pickupAssignments,
    createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString(),
  };
}

async function requireStopInScope(scope: OrgScope, stopId: string): Promise<{ id: string }> {
  const s = await prisma.transportStop.findFirst({ where: { id: stopId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true } });
  if (!s) throw new HttpError("NOT_FOUND", "Stop not found");
  return s;
}

export async function listStops(scope: OrgScope, params: { status?: string; search?: string } = {}): Promise<TransportStopDto[]> {
  const where: Prisma.TransportStopWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.status && params.status in STATUS_TO_DB) where.status = STATUS_TO_DB[params.status as TransportStopStatusDto] as never;
  if (params.search?.trim()) {
    const q = params.search.trim();
    where.OR = [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }];
  }
  const rows = await prisma.transportStop.findMany({ where, orderBy: { name: "asc" }, select });
  return rows.map(dto);
}

export async function getStop(scope: OrgScope, stopId: string): Promise<TransportStopDto> {
  await requireStopInScope(scope, stopId);
  const s = await prisma.transportStop.findUniqueOrThrow({ where: { id: stopId }, select });
  return dto(s);
}

export async function createStop(scope: OrgScope, raw: unknown): Promise<TransportStopDto> {
  const input = parseInput(createStopSchema, raw);
  const branchId = await resolveTransportBranch(scope);
  try {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.transportStop.create({
        data: { tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, name: input.name, code: input.code, address: input.address, landmark: input.landmark },
        select,
      });
      await recordAudit(tx, scope, "TRANSPORT_STOP_CREATED", "TransportStop", row.id, { name: row.name });
      return row;
    });
    return dto(created);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError("CONFLICT", "A stop with this code already exists");
    throw e;
  }
}

export const flagUnsafeSchema = z.object({ safetyNotes: z.string().trim().min(1).max(500) });

export async function flagStopUnsafe(scope: OrgScope, stopId: string, raw: unknown): Promise<TransportStopDto> {
  const input = parseInput(flagUnsafeSchema, raw);
  await requireStopInScope(scope, stopId);
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.transportStop.update({ where: { id: stopId }, data: { status: "UNSAFE", safetyNotes: input.safetyNotes }, select });
    await recordAudit(tx, scope, "TRANSPORT_STOP_UPDATED", "TransportStop", stopId, { status: "unsafe" });
    return row;
  });
  return dto(updated);
}

export async function setStopStatus(scope: OrgScope, stopId: string, status: TransportStopStatusDto): Promise<TransportStopDto> {
  await requireStopInScope(scope, stopId);
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.transportStop.update({ where: { id: stopId }, data: { status: STATUS_TO_DB[status] as never, ...(status === "active" ? { safetyNotes: null } : {}) }, select });
    await recordAudit(tx, scope, "TRANSPORT_STOP_UPDATED", "TransportStop", stopId, { status });
    return row;
  });
  return dto(updated);
}
