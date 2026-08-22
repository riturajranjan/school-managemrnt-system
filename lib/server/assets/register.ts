// Asset Register (Phase 9O) — real, individually tracked durable assets.
// Never "10 laptops" as one row: each physical unit is its own Asset with
// its own server-generated, unique assetTag. No depreciation/valuation
// field — `cost` is shown exactly as entered, never depreciated or posted
// to Accounting.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { AssetDto } from "@/lib/api/contracts";
import { resolveAssetBranch } from "./access";
import { nextAssetTag } from "./asset-tag";

type Row = {
  id: string; assetTag: string; name: string; category: string | null; serialNumber: string | null;
  manufacturer: string | null; model: string | null; purchaseDate: Date | null; cost: Prisma.Decimal | null;
  warrantyUntil: Date | null; notes: string | null; status: string; condition: string;
  locationId: string | null; createdAt: Date; updatedAt: Date;
  location: { name: string } | null;
  assignments: { staffId: string; assignedAt: Date; staff: { firstName: string; lastName: string | null; displayName: string | null } }[];
};

const select = {
  id: true, assetTag: true, name: true, category: true, serialNumber: true, manufacturer: true, model: true,
  purchaseDate: true, cost: true, warrantyUntil: true, notes: true, status: true, condition: true,
  locationId: true, createdAt: true, updatedAt: true,
  location: { select: { name: true } },
  assignments: { where: { returnedAt: null }, select: { staffId: true, assignedAt: true, staff: { select: { firstName: true, lastName: true, displayName: true } } } },
} satisfies Prisma.AssetSelect;

function staffName(s: { firstName: string; lastName: string | null; displayName: string | null }): string {
  return s.displayName?.trim() || `${s.firstName} ${s.lastName ?? ""}`.trim();
}

function dto(a: Row): AssetDto {
  const active = a.assignments[0] ?? null;
  return {
    id: a.id, assetTag: a.assetTag, name: a.name, category: a.category, serialNumber: a.serialNumber,
    manufacturer: a.manufacturer, model: a.model,
    purchaseDate: a.purchaseDate ? a.purchaseDate.toISOString().slice(0, 10) : null,
    cost: a.cost ? Number(a.cost) : null,
    warrantyUntil: a.warrantyUntil ? a.warrantyUntil.toISOString().slice(0, 10) : null,
    notes: a.notes, status: a.status.toLowerCase() as AssetDto["status"], condition: a.condition.toLowerCase() as AssetDto["condition"],
    locationId: a.locationId, locationName: a.location?.name ?? null,
    assignedToStaffId: active?.staffId ?? null, assignedToName: active ? staffName(active.staff) : null,
    createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString(),
  };
}

export async function listAssets(scope: OrgScope, params: { search?: string; status?: string; category?: string } = {}): Promise<AssetDto[]> {
  const where: Prisma.AssetWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.status) where.status = params.status.toUpperCase() as never;
  if (params.category) where.category = params.category;
  if (params.search) where.OR = [{ name: { contains: params.search, mode: "insensitive" } }, { assetTag: { contains: params.search, mode: "insensitive" } }, { serialNumber: { contains: params.search, mode: "insensitive" } }];
  const rows = await prisma.asset.findMany({ where, select, orderBy: { name: "asc" } });
  return rows.map(dto);
}

async function requireAssetRow(scope: OrgScope, assetId: string): Promise<Row> {
  const row = await prisma.asset.findFirst({ where: { id: assetId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select });
  if (!row) throw new HttpError("ASSET_NOT_FOUND", "Asset not found");
  return row;
}

export async function getAsset(scope: OrgScope, assetId: string): Promise<AssetDto> {
  return dto(await requireAssetRow(scope, assetId));
}

export const createAssetSchema = z.object({
  name: z.string().trim().min(1).max(160),
  category: z.string().trim().max(80).optional(),
  serialNumber: z.string().trim().max(120).optional(),
  manufacturer: z.string().trim().max(120).optional(),
  model: z.string().trim().max(120).optional(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  cost: z.number().nonnegative().optional(),
  warrantyUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().trim().max(500).optional(),
  locationId: z.string().min(1).optional(),
  condition: z.enum(["good", "fair", "poor", "damaged"]).optional(),
});

export async function createAsset(scope: OrgScope, raw: unknown): Promise<AssetDto> {
  const input = parseInput(createAssetSchema, raw);
  const branchId = await resolveAssetBranch(scope);
  if (input.locationId) {
    const loc = await prisma.inventoryLocation.findFirst({ where: { id: input.locationId, schoolId: scope.schoolId }, select: { id: true } });
    if (!loc) throw new HttpError("INVENTORY_LOCATION_NOT_FOUND", "Location not found");
  }

  const assetId = await prisma.$transaction(async (tx) => {
    const assetTag = await nextAssetTag(tx, scope.schoolId);
    const asset = await tx.asset.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, assetTag,
        name: input.name, category: input.category, serialNumber: input.serialNumber,
        manufacturer: input.manufacturer, model: input.model,
        purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : undefined,
        cost: input.cost, warrantyUntil: input.warrantyUntil ? new Date(input.warrantyUntil) : undefined,
        notes: input.notes, locationId: input.locationId, condition: input.condition ? (input.condition.toUpperCase() as never) : undefined,
      },
      select: { id: true, assetTag: true },
    });
    await recordAudit(tx, scope, "ASSET_CREATED", "Asset", asset.id, { assetTag: asset.assetTag, name: input.name });
    return asset.id;
  });

  return getAsset(scope, assetId);
}

export const updateAssetSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  category: z.string().trim().max(80).nullable().optional(),
  serialNumber: z.string().trim().max(120).nullable().optional(),
  manufacturer: z.string().trim().max(120).nullable().optional(),
  model: z.string().trim().max(120).nullable().optional(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  cost: z.number().nonnegative().nullable().optional(),
  warrantyUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  locationId: z.string().nullable().optional(),
  condition: z.enum(["good", "fair", "poor", "damaged"]).optional(),
});

export async function updateAsset(scope: OrgScope, assetId: string, raw: unknown): Promise<AssetDto> {
  const input = parseInput(updateAssetSchema, raw);
  await requireAssetRow(scope, assetId);
  if (input.locationId) {
    const loc = await prisma.inventoryLocation.findFirst({ where: { id: input.locationId, schoolId: scope.schoolId }, select: { id: true } });
    if (!loc) throw new HttpError("INVENTORY_LOCATION_NOT_FOUND", "Location not found");
  }
  await prisma.asset.update({
    where: { id: assetId },
    data: {
      name: input.name, category: input.category, serialNumber: input.serialNumber, manufacturer: input.manufacturer, model: input.model,
      purchaseDate: input.purchaseDate === undefined ? undefined : input.purchaseDate ? new Date(input.purchaseDate) : null,
      cost: input.cost, warrantyUntil: input.warrantyUntil === undefined ? undefined : input.warrantyUntil ? new Date(input.warrantyUntil) : null,
      notes: input.notes, locationId: input.locationId, condition: input.condition ? (input.condition.toUpperCase() as never) : undefined,
    },
  });
  await recordAudit(prisma, scope, "ASSET_UPDATED", "Asset", assetId, input);
  return getAsset(scope, assetId);
}
