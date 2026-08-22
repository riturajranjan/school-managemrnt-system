// Asset Assign / Return (Phase 9O) — real, server-authoritative custody.
// The holder is always a real Staff.id, never a name string. Concurrency
// safety on assign is belt-and-suspenders: a conditional Asset-status update
// (AVAILABLE -> ASSIGNED WHERE status = AVAILABLE) plus a partial unique
// index on asset_assignments(assetId) WHERE returnedAt IS NULL — mirrors
// Phase 9N's library loans dual-guard exactly.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { createNotification } from "@/lib/server/notifications/service";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { AssetAssignmentDto } from "@/lib/api/contracts";
import { resolveAssetBranch, staffDisplayName } from "./access";

type Row = {
  id: string; assetId: string; staffId: string; assignedAt: Date; returnedAt: Date | null; notes: string | null; createdAt: Date;
  asset: { name: string; assetTag: string };
  staff: { firstName: string; lastName: string | null; displayName: string | null };
};

const select = {
  id: true, assetId: true, staffId: true, assignedAt: true, returnedAt: true, notes: true, createdAt: true,
  asset: { select: { name: true, assetTag: true } },
  staff: { select: { firstName: true, lastName: true, displayName: true } },
} satisfies Prisma.AssetAssignmentSelect;

function dto(r: Row): AssetAssignmentDto {
  return {
    id: r.id, assetId: r.assetId, assetName: r.asset.name, assetTag: r.asset.assetTag,
    staffId: r.staffId, staffName: staffDisplayName(r.staff),
    assignedAt: r.assignedAt.toISOString(), returnedAt: r.returnedAt?.toISOString() ?? null,
    status: r.returnedAt ? "returned" : "active", notes: r.notes, createdAt: r.createdAt.toISOString(),
  };
}

export async function listAssignments(scope: OrgScope, params: { assetId?: string; staffId?: string; status?: "active" | "returned" } = {}): Promise<AssetAssignmentDto[]> {
  const where: Prisma.AssetAssignmentWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.assetId) where.assetId = params.assetId;
  if (params.staffId) where.staffId = params.staffId;
  if (params.status === "active") where.returnedAt = null;
  if (params.status === "returned") where.returnedAt = { not: null };
  const rows = await prisma.assetAssignment.findMany({ where, select, orderBy: { createdAt: "desc" } });
  return rows.map(dto);
}

async function requireAssignmentRow(scope: OrgScope, assignmentId: string): Promise<Row> {
  const row = await prisma.assetAssignment.findFirst({ where: { id: assignmentId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select });
  if (!row) throw new HttpError("ASSET_ASSIGNMENT_NOT_FOUND", "Assignment not found");
  return row;
}

export const assignAssetSchema = z.object({ assetId: z.string().min(1), staffId: z.string().min(1), notes: z.string().trim().max(300).optional() });

export async function assignAsset(scope: OrgScope, raw: unknown): Promise<AssetAssignmentDto> {
  const input = parseInput(assignAssetSchema, raw);
  const branchId = await resolveAssetBranch(scope);

  const asset = await prisma.asset.findFirst({ where: { id: input.assetId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true, status: true } });
  if (!asset) throw new HttpError("ASSET_NOT_FOUND", "Asset not found");
  if (asset.status !== "AVAILABLE") throw new HttpError("ASSET_NOT_AVAILABLE", "This asset is not available for assignment");

  const staff = await prisma.staff.findFirst({ where: { id: input.staffId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true, userId: true } });
  if (!staff) throw new HttpError("INVALID_RECIPIENT", "Recipient must be a real, active staff member in this school");

  try {
    const assignmentId = await prisma.$transaction(async (tx) => {
      const updated = await tx.asset.updateMany({ where: { id: input.assetId, status: "AVAILABLE" }, data: { status: "ASSIGNED" } });
      if (updated.count === 0) throw new HttpError("ASSET_NOT_AVAILABLE", "This asset is not available for assignment");
      const assignment = await tx.assetAssignment.create({
        data: { tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, assetId: input.assetId, staffId: input.staffId, notes: input.notes, assignedByUserId: scope.actor.id },
        select: { id: true },
      });
      await recordAudit(tx, scope, "ASSET_ASSIGNED", "AssetAssignment", assignment.id, { assetId: input.assetId, staffId: input.staffId });

      if (staff.userId) {
        await createNotification(tx, {
          tenantId: scope.tenantId, schoolId: scope.schoolId, type: "ASSET_ASSIGNED",
          title: "Asset assigned", body: "An asset has been assigned to you.", href: "/assets/assignments",
          sourceType: "AssetAssignment", sourceId: assignment.id, dedupeKey: `ASSET_ASSIGNED:${assignment.id}`, recipientUserIds: [staff.userId],
        });
      }
      return assignment.id;
    });
    return dto(await requireAssignmentRow(scope, assignmentId));
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError("ASSET_NOT_AVAILABLE", "This asset is not available for assignment");
    throw e;
  }
}

export async function returnAsset(scope: OrgScope, assignmentId: string): Promise<AssetAssignmentDto> {
  const assignment = await requireAssignmentRow(scope, assignmentId);
  if (assignment.returnedAt) throw new HttpError("ASSET_ALREADY_RETURNED", "This assignment is already returned");

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    const updated = await tx.assetAssignment.updateMany({ where: { id: assignmentId, returnedAt: null }, data: { returnedAt: now, returnedByUserId: scope.actor.id } });
    if (updated.count === 0) throw new HttpError("ASSET_ALREADY_RETURNED", "This assignment is already returned");
    await tx.asset.updateMany({ where: { id: assignment.assetId, status: "ASSIGNED" }, data: { status: "AVAILABLE" } });
    await recordAudit(tx, scope, "ASSET_RETURNED", "AssetAssignment", assignmentId, { assetId: assignment.assetId });

    const staffRow = await tx.staff.findUnique({ where: { id: assignment.staffId }, select: { userId: true } });
    if (staffRow?.userId) {
      await createNotification(tx, {
        tenantId: scope.tenantId, schoolId: scope.schoolId, type: "ASSET_RETURNED",
        title: "Asset returned", body: "Your asset return has been recorded.", href: "/assets/assignments",
        sourceType: "AssetAssignment", sourceId: assignmentId, dedupeKey: `ASSET_RETURNED:${assignmentId}`, recipientUserIds: [staffRow.userId],
      });
    }
  });
  return dto(await requireAssignmentRow(scope, assignmentId));
}
