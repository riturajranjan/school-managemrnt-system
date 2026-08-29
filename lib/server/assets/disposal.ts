// Asset disposal (production migration, Phase A) — a real terminal audit
// record, not a multi-stage approval workflow (no request/review/approve
// states — if that's ever genuinely needed, it should be asked for
// explicitly, not built speculatively). Disposing an asset always sets its
// status to RETIRED in the same transaction; an asset can be disposed at
// most once (Asset.disposal is 1:1, enforced by the unique assetId column).
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { AssetDisposalDto } from "@/lib/api/contracts";
import { getAsset } from "./register";

// Disposal is reachable from any non-ASSIGNED, non-RETIRED state; an
// ASSIGNED asset must be returned first (mirrors setAssetStatus's own rule),
// which this closes automatically rather than blocking the disposal.
const DISPOSABLE_FROM = ["AVAILABLE", "MAINTENANCE", "LOST", "DAMAGED", "ASSIGNED"];

const select = {
  id: true, assetId: true, reason: true, value: true, recipient: true, notes: true, disposedAt: true, createdAt: true,
  asset: { select: { name: true, assetTag: true } },
  approvedByUser: { select: { name: true, email: true } },
  createdByUser: { select: { name: true, email: true } },
} satisfies Prisma.AssetDisposalSelect;

type Row = Prisma.AssetDisposalGetPayload<{ select: typeof select }>;

function dto(d: Row): AssetDisposalDto {
  return {
    id: d.id, assetId: d.assetId, assetName: d.asset.name, assetTag: d.asset.assetTag,
    reason: d.reason.toLowerCase() as AssetDisposalDto["reason"],
    value: d.value ? Number(d.value) : null, recipient: d.recipient, notes: d.notes,
    disposedAt: d.disposedAt.toISOString().slice(0, 10),
    approvedByName: d.approvedByUser ? (d.approvedByUser.name ?? d.approvedByUser.email) : null,
    createdByName: d.createdByUser.name ?? d.createdByUser.email,
    createdAt: d.createdAt.toISOString(),
  };
}

export async function listAssetDisposals(scope: OrgScope): Promise<AssetDisposalDto[]> {
  const rows = await prisma.assetDisposal.findMany({ where: { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select, orderBy: { disposedAt: "desc" } });
  return rows.map(dto);
}

export const createAssetDisposalSchema = z.object({
  reason: z.enum(["end_of_life", "damaged", "sold", "donated", "lost", "stolen", "replaced", "other"]),
  value: z.number().nonnegative().optional(),
  recipient: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(500).optional(),
  disposedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  approvedByUserId: z.string().min(1).optional(),
});

export async function disposeAsset(scope: OrgScope, assetId: string, raw: unknown): Promise<{ asset: Awaited<ReturnType<typeof getAsset>>; disposal: AssetDisposalDto }> {
  const input = parseInput(createAssetDisposalSchema, raw);

  const asset = await prisma.asset.findFirst({ where: { id: assetId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true, status: true, branchId: true } });
  if (!asset) throw new HttpError("ASSET_NOT_FOUND", "Asset not found");
  if (asset.status === "RETIRED") throw new HttpError("ASSET_ALREADY_DISPOSED", "This asset has already been disposed");
  if (!DISPOSABLE_FROM.includes(asset.status)) throw new HttpError("INVALID_ASSET_STATUS_TRANSITION", `Cannot dispose an asset that is ${asset.status.toLowerCase()}`);

  if (input.approvedByUserId) {
    const approver = await prisma.tenantMembership.findFirst({ where: { userId: input.approvedByUserId, tenantId: scope.tenantId, status: "ACTIVE" }, select: { id: true } });
    if (!approver) throw new HttpError("VALIDATION_ERROR", "Approver is not a member of this school's organization");
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.asset.updateMany({ where: { id: assetId, status: asset.status }, data: { status: "RETIRED" } });
    if (updated.count === 0) throw new HttpError("CONFLICT", "This asset's status changed — retry");

    if (asset.status === "ASSIGNED") {
      await tx.assetAssignment.updateMany({ where: { assetId, returnedAt: null }, data: { returnedAt: new Date(), returnedByUserId: scope.actor.id } });
    }

    await tx.assetDisposal.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: asset.branchId,
        assetId, reason: input.reason.toUpperCase() as never, value: input.value, recipient: input.recipient, notes: input.notes,
        disposedAt: new Date(input.disposedAt), approvedByUserId: input.approvedByUserId, createdByUserId: scope.actor.id,
      },
    });
    await recordAudit(tx, scope, "ASSET_DISPOSED", "Asset", assetId, { reason: input.reason, value: input.value });
  });

  const disposalRow = await prisma.assetDisposal.findUniqueOrThrow({ where: { assetId }, select });
  return { asset: await getAsset(scope, assetId), disposal: dto(disposalRow) };
}
