// Asset history (Phase 9O) — reads the real AuditEvent trail this domain
// writes (ASSET_CREATED/UPDATED/ASSIGNED/RETURNED/STATUS_CHANGED/
// MAINTENANCE_*). Replaces the pre-migration mock ResourceAuditTrail
// component, which had zero real backing.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import type { AssetHistoryEventDto } from "@/lib/api/contracts";

export async function getAssetHistory(scope: OrgScope, assetId: string): Promise<AssetHistoryEventDto[]> {
  const asset = await prisma.asset.findFirst({ where: { id: assetId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true } });
  if (!asset) throw new HttpError("ASSET_NOT_FOUND", "Asset not found");

  const [assetEvents, assignmentEvents] = await Promise.all([
    prisma.auditEvent.findMany({ where: { tenantId: scope.tenantId, entityType: "Asset", entityId: assetId }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.assetAssignment.findMany({ where: { assetId }, select: { id: true } }),
  ]);
  const assignmentIds = assignmentEvents.map((a) => a.id);
  const assignmentAuditEvents = assignmentIds.length
    ? await prisma.auditEvent.findMany({ where: { tenantId: scope.tenantId, entityType: "AssetAssignment", entityId: { in: assignmentIds } }, orderBy: { createdAt: "desc" }, take: 50 })
    : [];

  const all = [...assetEvents, ...assignmentAuditEvents].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return all.slice(0, 50).map((e) => ({ id: e.id, action: e.action, actorName: e.actorName, meta: (e.metaJson as Record<string, unknown> | null) ?? null, createdAt: e.createdAt.toISOString() }));
}

/** Cross-asset audit feed for the Assets Audit hub page — recent AssetEvents
 * across the school. */
export async function listAssetAuditFeed(scope: OrgScope): Promise<AssetHistoryEventDto[]> {
  const rows = await prisma.auditEvent.findMany({
    where: { tenantId: scope.tenantId, schoolId: scope.schoolId, entityType: { in: ["Asset", "AssetAssignment", "AssetMaintenanceRecord"] } },
    orderBy: { createdAt: "desc" }, take: 100,
  });
  return rows.map((e) => ({ id: e.id, action: e.action, actorName: e.actorName, meta: (e.metaJson as Record<string, unknown> | null) ?? null, createdAt: e.createdAt.toISOString() }));
}
