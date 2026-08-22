// Asset Maintenance (Phase 9O) — structurally simple, non-financial-workflow
// records. `cost`/`vendorName` are plain display fields, never posted to
// Accounting. Opening a record requires the asset to be AVAILABLE (moves it
// to MAINTENANCE); completing/cancelling returns it to AVAILABLE. An asset
// that is ASSIGNED must be returned first — no "maintenance while assigned"
// semantics are invented.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { AssetMaintenanceDto } from "@/lib/api/contracts";
import { resolveAssetBranch } from "./access";

type Row = {
  id: string; assetId: string; type: string; status: string; description: string; vendorName: string | null;
  cost: Prisma.Decimal | null; openedAt: Date; completedAt: Date | null; createdAt: Date;
  asset: { name: string; assetTag: string };
};

const select = {
  id: true, assetId: true, type: true, status: true, description: true, vendorName: true, cost: true,
  openedAt: true, completedAt: true, createdAt: true, asset: { select: { name: true, assetTag: true } },
} satisfies Prisma.AssetMaintenanceRecordSelect;

function dto(r: Row): AssetMaintenanceDto {
  return {
    id: r.id, assetId: r.assetId, assetName: r.asset.name, assetTag: r.asset.assetTag,
    type: r.type.toLowerCase() as AssetMaintenanceDto["type"], status: r.status.toLowerCase().replace(/_/g, "-") as AssetMaintenanceDto["status"],
    description: r.description, vendorName: r.vendorName, cost: r.cost ? Number(r.cost) : null,
    openedAt: r.openedAt.toISOString(), completedAt: r.completedAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString(),
  };
}

export async function listMaintenance(scope: OrgScope, params: { assetId?: string; status?: string } = {}): Promise<AssetMaintenanceDto[]> {
  const where: Prisma.AssetMaintenanceRecordWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.assetId) where.assetId = params.assetId;
  if (params.status) where.status = params.status.toUpperCase().replace(/-/g, "_") as never;
  const rows = await prisma.assetMaintenanceRecord.findMany({ where, select, orderBy: [{ status: "asc" }, { openedAt: "asc" }] });
  return rows.map(dto);
}

async function requireMaintenanceRow(scope: OrgScope, recordId: string): Promise<Row> {
  const row = await prisma.assetMaintenanceRecord.findFirst({ where: { id: recordId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select });
  if (!row) throw new HttpError("ASSET_MAINTENANCE_NOT_FOUND", "Maintenance record not found");
  return row;
}

export const openMaintenanceSchema = z.object({
  assetId: z.string().min(1),
  type: z.enum(["preventive", "repair", "inspection", "other"]).default("repair"),
  description: z.string().trim().min(1).max(500),
  vendorName: z.string().trim().max(160).optional(),
  cost: z.number().nonnegative().optional(),
});

export async function openMaintenance(scope: OrgScope, raw: unknown): Promise<AssetMaintenanceDto> {
  const input = parseInput(openMaintenanceSchema, raw);
  const branchId = await resolveAssetBranch(scope);
  const asset = await prisma.asset.findFirst({ where: { id: input.assetId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true, status: true } });
  if (!asset) throw new HttpError("ASSET_NOT_FOUND", "Asset not found");
  if (asset.status !== "AVAILABLE") throw new HttpError("ASSET_NOT_AVAILABLE", "The asset must be AVAILABLE to open a maintenance record (return or complete its current lifecycle first)");

  const recordId = await prisma.$transaction(async (tx) => {
    const updated = await tx.asset.updateMany({ where: { id: input.assetId, status: "AVAILABLE" }, data: { status: "MAINTENANCE" } });
    if (updated.count === 0) throw new HttpError("ASSET_NOT_AVAILABLE", "The asset must be AVAILABLE to open a maintenance record");
    const record = await tx.assetMaintenanceRecord.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, assetId: input.assetId,
        type: input.type.toUpperCase() as never, description: input.description, vendorName: input.vendorName, cost: input.cost,
        createdByUserId: scope.actor.id,
      },
      select: { id: true },
    });
    await recordAudit(tx, scope, "ASSET_MAINTENANCE_OPENED", "AssetMaintenanceRecord", record.id, { assetId: input.assetId });
    return record.id;
  });

  return dto(await requireMaintenanceRow(scope, recordId));
}

export const completeMaintenanceSchema = z.object({ status: z.enum(["completed", "cancelled"]).default("completed"), cost: z.number().nonnegative().optional() });

export async function completeMaintenance(scope: OrgScope, recordId: string, raw: unknown = {}): Promise<AssetMaintenanceDto> {
  const input = parseInput(completeMaintenanceSchema, raw);
  const record = await requireMaintenanceRow(scope, recordId);
  if (record.status === "COMPLETED" || record.status === "CANCELLED") throw new HttpError("VALIDATION_ERROR", "This maintenance record is already closed");

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    const targetStatus = input.status.toUpperCase();
    const updated = await tx.assetMaintenanceRecord.updateMany({
      where: { id: recordId, status: { in: ["OPEN", "IN_PROGRESS"] } },
      data: { status: targetStatus as never, completedAt: now, cost: input.cost },
    });
    if (updated.count === 0) throw new HttpError("VALIDATION_ERROR", "This maintenance record is already closed");
    await tx.asset.updateMany({ where: { id: record.assetId, status: "MAINTENANCE" }, data: { status: "AVAILABLE" } });
    await recordAudit(tx, scope, "ASSET_MAINTENANCE_COMPLETED", "AssetMaintenanceRecord", recordId, { assetId: record.assetId, status: targetStatus });
  });

  return dto(await requireMaintenanceRow(scope, recordId));
}
