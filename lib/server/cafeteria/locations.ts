// Cafeteria Locations (Phase 9T) — the real serving-location master (replaces
// the old mock "counters" concept as a genuine, real entity).
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { CafeteriaLocationDto } from "@/lib/api/contracts";
import { resolveCafeteriaBranch } from "./access";

type Row = { id: string; code: string; name: string; description: string | null; status: string; createdAt: Date; updatedAt: Date };

const select = { id: true, code: true, name: true, description: true, status: true, createdAt: true, updatedAt: true } satisfies Prisma.CafeteriaLocationSelect;

function dto(r: Row): CafeteriaLocationDto {
  return {
    id: r.id, code: r.code, name: r.name, description: r.description,
    status: r.status.toLowerCase() as CafeteriaLocationDto["status"],
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  };
}

export async function listLocations(scope: OrgScope, params: { status?: string } = {}): Promise<CafeteriaLocationDto[]> {
  const where: Prisma.CafeteriaLocationWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.status) where.status = params.status.toUpperCase() as never;
  const rows = await prisma.cafeteriaLocation.findMany({ where, select, orderBy: { name: "asc" } });
  return rows.map(dto);
}

async function requireLocationRow(scope: OrgScope, locationId: string): Promise<Row> {
  const row = await prisma.cafeteriaLocation.findFirst({ where: { id: locationId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select });
  if (!row) throw new HttpError("CAFETERIA_LOCATION_NOT_FOUND", "Location not found");
  return row;
}

export async function getLocation(scope: OrgScope, locationId: string): Promise<CafeteriaLocationDto> {
  return dto(await requireLocationRow(scope, locationId));
}

export async function requireLocationInScope(scope: OrgScope, locationId: string): Promise<{ id: string }> {
  const row = await prisma.cafeteriaLocation.findFirst({ where: { id: locationId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true } });
  if (!row) throw new HttpError("CAFETERIA_LOCATION_NOT_FOUND", "Location not found");
  return row;
}

export const createLocationSchema = z.object({
  code: z.string().trim().min(1).max(24),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(300).optional(),
});

export async function createLocation(scope: OrgScope, raw: unknown): Promise<CafeteriaLocationDto> {
  const input = parseInput(createLocationSchema, raw);
  const branchId = await resolveCafeteriaBranch(scope);
  let row;
  try {
    row = await prisma.cafeteriaLocation.create({
      data: { tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, code: input.code, name: input.name, description: input.description },
      select,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError("CAFETERIA_LOCATION_CODE_EXISTS", "A location with this code already exists");
    throw e;
  }
  await recordAudit(prisma, scope, "CAFETERIA_LOCATION_CREATED", "CafeteriaLocation", row.id, { code: row.code });
  return dto(row);
}

export const updateLocationSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(300).nullable().optional(),
  status: z.enum(["active", "inactive", "archived"]).optional(),
});

export async function updateLocation(scope: OrgScope, locationId: string, raw: unknown): Promise<CafeteriaLocationDto> {
  const input = parseInput(updateLocationSchema, raw);
  await requireLocationRow(scope, locationId);
  const row = await prisma.cafeteriaLocation.update({
    where: { id: locationId },
    data: { name: input.name, description: input.description, status: input.status ? (input.status.toUpperCase() as never) : undefined },
    select,
  });
  await recordAudit(prisma, scope, "CAFETERIA_LOCATION_UPDATED", "CafeteriaLocation", locationId, input);
  return dto(row);
}
