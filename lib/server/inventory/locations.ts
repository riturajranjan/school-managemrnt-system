// Inventory Locations (Phase 9O). Minimal real infrastructure — no warehouse
// hierarchy invented beyond what Transfers needs to be honest. A "Main
// Store" is auto-created per branch on first access (get-or-create, same
// shape as Library's getOrCreateLibraryPolicy) so Receipts/Issues/
// Adjustments always have a real location to post against.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { InventoryLocationDto } from "@/lib/api/contracts";
import { resolveInventoryBranch } from "./access";

const DEFAULT_LOCATION_NAME = "Main Store";

function dto(l: { id: string; name: string; status: string; createdAt: Date }): InventoryLocationDto {
  return { id: l.id, name: l.name, status: l.status.toLowerCase() as "active" | "archived", createdAt: l.createdAt.toISOString() };
}

export async function listLocations(scope: OrgScope): Promise<InventoryLocationDto[]> {
  const rows = await prisma.inventoryLocation.findMany({
    where: { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    orderBy: { name: "asc" },
  });
  return rows.map(dto);
}

export const createLocationSchema = z.object({ name: z.string().trim().min(1).max(120) });

export async function createLocation(scope: OrgScope, raw: unknown): Promise<InventoryLocationDto> {
  const input = parseInput(createLocationSchema, raw);
  const branchId = await resolveInventoryBranch(scope);
  try {
    const row = await prisma.inventoryLocation.create({
      data: { tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, name: input.name },
    });
    await recordAudit(prisma, scope, "INVENTORY_LOCATION_CREATED", "InventoryLocation", row.id, { name: row.name });
    return dto(row);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError("INVENTORY_LOCATION_NAME_EXISTS", "A location with this name already exists");
    throw e;
  }
}

/** Get-or-create the branch's default location by name (case-insensitive).
 * Used by Transfers to preserve the pre-migration free-text UX while backing
 * it with a real, race-safe FK. */
export async function resolveOrCreateLocation(scope: OrgScope, name: string): Promise<{ id: string }> {
  const branchId = await resolveInventoryBranch(scope);
  const trimmed = name.trim();
  if (!trimmed) throw new HttpError("VALIDATION_ERROR", "Location name is required");
  const existing = await prisma.inventoryLocation.findFirst({
    where: { schoolId: scope.schoolId, branchId, name: { equals: trimmed, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing;
  try {
    const row = await prisma.inventoryLocation.create({ data: { tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, name: trimmed }, select: { id: true } });
    await recordAudit(prisma, scope, "INVENTORY_LOCATION_CREATED", "InventoryLocation", row.id, { name: trimmed });
    return row;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const row = await prisma.inventoryLocation.findFirstOrThrow({ where: { schoolId: scope.schoolId, branchId, name: { equals: trimmed, mode: "insensitive" } }, select: { id: true } });
      return row;
    }
    throw e;
  }
}

/** Get-or-create the branch's default "Main Store" — never surfaced as a
 * choice the user makes; used as the implicit location for a fresh item's
 * opening stock / receipts when the caller doesn't pick one. */
export async function getOrCreateDefaultLocation(scope: OrgScope): Promise<{ id: string }> {
  return resolveOrCreateLocation(scope, DEFAULT_LOCATION_NAME);
}

export async function requireLocationInScope(scope: OrgScope, locationId: string): Promise<{ id: string; branchId: string }> {
  const loc = await prisma.inventoryLocation.findFirst({
    where: { id: locationId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select: { id: true, branchId: true },
  });
  if (!loc) throw new HttpError("INVENTORY_LOCATION_NOT_FOUND", "Location not found");
  return loc;
}
