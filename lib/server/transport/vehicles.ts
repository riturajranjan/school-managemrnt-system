// Transport Vehicles (Phase 9M) — real, PostgreSQL-backed. No telemetry, no
// documents/health-score (those depend on maintenance/document tracking that
// doesn't exist yet — deliberately deferred, not fabricated).
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { TransportVehicleDto, TransportVehicleStatusDto, TransportVehicleTypeDto } from "@/lib/api/contracts";
import { resolveTransportBranch } from "./access";

const TYPE_TO_DB: Record<TransportVehicleTypeDto, string> = {
  bus: "BUS", "mini-bus": "MINI_BUS", van: "VAN", car: "CAR",
  "electric-vehicle": "ELECTRIC_VEHICLE", "contract-vehicle": "CONTRACT_VEHICLE", custom: "CUSTOM",
};
const typeToUi = (t: string): TransportVehicleTypeDto => (Object.entries(TYPE_TO_DB).find(([, v]) => v === t)?.[0] as TransportVehicleTypeDto) ?? "custom";
const statusToUi = (s: string): TransportVehicleStatusDto => s.toLowerCase() as TransportVehicleStatusDto;
const STATUS_TO_DB: Record<TransportVehicleStatusDto, string> = { active: "ACTIVE", inactive: "INACTIVE", maintenance: "MAINTENANCE", archived: "ARCHIVED" };

const typeEnum = z.enum(["bus", "mini-bus", "van", "car", "electric-vehicle", "contract-vehicle", "custom"]);

export const createVehicleSchema = z.object({
  registrationNumber: z.string().trim().min(1).max(32),
  displayName: z.string().trim().max(60).optional(),
  type: typeEnum.optional(),
  make: z.string().trim().max(60).optional(),
  model: z.string().trim().max(60).optional(),
  capacity: z.number().int().min(1).max(200),
});
export const updateVehicleSchema = createVehicleSchema.partial();

type Row = { id: string; registrationNumber: string; displayName: string | null; type: string; make: string | null; model: string | null; capacity: number; status: string; createdAt: Date; updatedAt: Date };
const select = { id: true, registrationNumber: true, displayName: true, type: true, make: true, model: true, capacity: true, status: true, createdAt: true, updatedAt: true } satisfies Prisma.TransportVehicleSelect;

function dto(v: Row): TransportVehicleDto {
  return {
    id: v.id, registrationNumber: v.registrationNumber, displayName: v.displayName, type: typeToUi(v.type),
    make: v.make, model: v.model, capacity: v.capacity, status: statusToUi(v.status),
    createdAt: v.createdAt.toISOString(), updatedAt: v.updatedAt.toISOString(),
  };
}

async function requireVehicleInScope(scope: OrgScope, vehicleId: string): Promise<{ id: string }> {
  const v = await prisma.transportVehicle.findFirst({ where: { id: vehicleId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true } });
  if (!v) throw new HttpError("NOT_FOUND", "Vehicle not found");
  return v;
}

export async function listVehicles(scope: OrgScope, params: { status?: string; search?: string } = {}): Promise<TransportVehicleDto[]> {
  const where: Prisma.TransportVehicleWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.status && params.status in STATUS_TO_DB) where.status = STATUS_TO_DB[params.status as TransportVehicleStatusDto] as never;
  if (params.search?.trim()) {
    const q = params.search.trim();
    where.OR = [{ registrationNumber: { contains: q, mode: "insensitive" } }, { displayName: { contains: q, mode: "insensitive" } }];
  }
  const rows = await prisma.transportVehicle.findMany({ where, orderBy: { registrationNumber: "asc" }, select });
  return rows.map(dto);
}

export async function getVehicle(scope: OrgScope, vehicleId: string): Promise<TransportVehicleDto> {
  await requireVehicleInScope(scope, vehicleId);
  const v = await prisma.transportVehicle.findUniqueOrThrow({ where: { id: vehicleId }, select });
  return dto(v);
}

/**
 * Registration-number uniqueness is DB-enforced (@@unique([schoolId,
 * registrationNumber])) — the real concurrency guarantee. A race-losing
 * concurrent create raises P2002, mapped to a friendly CONFLICT here.
 */
export async function createVehicle(scope: OrgScope, raw: unknown): Promise<TransportVehicleDto> {
  const input = parseInput(createVehicleSchema, raw);
  const branchId = await resolveTransportBranch(scope);
  try {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.transportVehicle.create({
        data: {
          tenantId: scope.tenantId, schoolId: scope.schoolId, branchId,
          registrationNumber: input.registrationNumber, displayName: input.displayName,
          type: input.type ? (TYPE_TO_DB[input.type] as never) : undefined,
          make: input.make, model: input.model, capacity: input.capacity,
        },
        select,
      });
      await recordAudit(tx, scope, "TRANSPORT_VEHICLE_CREATED", "TransportVehicle", row.id, { registrationNumber: row.registrationNumber });
      return row;
    });
    return dto(created);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new HttpError("CONFLICT", "A vehicle with this registration number already exists");
    }
    throw e;
  }
}

export async function updateVehicle(scope: OrgScope, vehicleId: string, raw: unknown): Promise<TransportVehicleDto> {
  const input = parseInput(updateVehicleSchema, raw);
  await requireVehicleInScope(scope, vehicleId);
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.transportVehicle.update({
        where: { id: vehicleId },
        data: {
          registrationNumber: input.registrationNumber, displayName: input.displayName,
          type: input.type ? (TYPE_TO_DB[input.type] as never) : undefined,
          make: input.make, model: input.model, capacity: input.capacity,
        },
        select,
      });
      await recordAudit(tx, scope, "TRANSPORT_VEHICLE_UPDATED", "TransportVehicle", vehicleId);
      return row;
    });
    return dto(updated);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new HttpError("CONFLICT", "A vehicle with this registration number already exists");
    }
    throw e;
  }
}

export async function setVehicleStatus(scope: OrgScope, vehicleId: string, status: TransportVehicleStatusDto): Promise<TransportVehicleDto> {
  await requireVehicleInScope(scope, vehicleId);
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.transportVehicle.update({ where: { id: vehicleId }, data: { status: STATUS_TO_DB[status] as never }, select });
    await recordAudit(tx, scope, "TRANSPORT_VEHICLE_UPDATED", "TransportVehicle", vehicleId, { status });
    return row;
  });
  return dto(updated);
}
