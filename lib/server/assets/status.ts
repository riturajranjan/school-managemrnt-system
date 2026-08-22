// Asset status transitions (Phase 9O) — LOST/DAMAGED/RETIRED. If the asset
// was ASSIGNED when marked LOST/DAMAGED, its active assignment is closed
// (returnedAt set) so history never shows a dangling "active" assignment on
// an asset that's gone — mirrors Library's markCopyLost exactly. RETIRED is
// only reachable from AVAILABLE (a checked-out or in-maintenance asset must
// be returned/completed first — no silent bypass of those lifecycles).
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { AssetDto } from "@/lib/api/contracts";
import { getAsset } from "./register";

export const setAssetStatusSchema = z.object({ status: z.enum(["lost", "damaged", "retired", "available"]) });

const ALLOWED_FROM: Record<string, string[]> = {
  LOST: ["AVAILABLE", "ASSIGNED", "MAINTENANCE"],
  DAMAGED: ["AVAILABLE", "ASSIGNED", "MAINTENANCE"],
  RETIRED: ["AVAILABLE"],
  AVAILABLE: ["LOST", "DAMAGED"], // recovering a lost/damaged asset back into circulation
};

export async function setAssetStatus(scope: OrgScope, assetId: string, raw: unknown): Promise<AssetDto> {
  const input = parseInput(setAssetStatusSchema, raw);
  const targetStatus = input.status.toUpperCase();
  const asset = await prisma.asset.findFirst({ where: { id: assetId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true, status: true } });
  if (!asset) throw new HttpError("ASSET_NOT_FOUND", "Asset not found");
  if (!ALLOWED_FROM[targetStatus]?.includes(asset.status)) throw new HttpError("INVALID_ASSET_STATUS_TRANSITION", `Cannot move an asset from ${asset.status} to ${targetStatus}`);

  await prisma.$transaction(async (tx) => {
    const updated = await tx.asset.updateMany({ where: { id: assetId, status: asset.status }, data: { status: targetStatus as never } });
    if (updated.count === 0) throw new HttpError("CONFLICT", "This asset's status changed — retry");

    if ((targetStatus === "LOST" || targetStatus === "DAMAGED") && asset.status === "ASSIGNED") {
      const now = new Date();
      await tx.assetAssignment.updateMany({ where: { assetId, returnedAt: null }, data: { returnedAt: now, returnedByUserId: scope.actor.id } });
    }
    await recordAudit(tx, scope, "ASSET_STATUS_CHANGED", "Asset", assetId, { from: asset.status, to: targetStatus });
  });

  return getAsset(scope, assetId);
}
