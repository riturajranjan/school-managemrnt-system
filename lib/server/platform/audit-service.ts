// Platform audit/activity read service (Super Admin Phase SA-4N).
//
// A READ-ONLY view over the existing AuditEvent table (written by every phase) —
// NOT a second event store. Server-side filtering + pagination (never load the
// whole log into the browser). Audit is evidence: no create/update/delete here.
// The DTO exposes only safe fields and defensively strips any secret-looking
// metadata key.
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { AuditEventDto } from "@/lib/api/contracts";

export type AuditListParams = {
  page: number;
  pageSize: number;
  search?: string;
  action?: string;
  actor?: string;
  schoolId?: string;
  from?: string;
  to?: string;
};

const SECRET_KEY_RE = /(secret|token|password|hash|api[_-]?key|client[_-]?secret|private[_-]?key|credential)/i;

function safeMeta(meta: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (SECRET_KEY_RE.test(k)) continue; // never surface secret-looking values
    out[k] = v;
  }
  return out;
}

type Row = {
  id: string; action: string; entityType: string; entityId: string;
  actorUserId: string | null; actorName: string | null; tenantId: string; schoolId: string | null;
  metaJson: Prisma.JsonValue | null; createdAt: Date;
};

function toDto(e: Row): AuditEventDto {
  return {
    id: e.id, action: e.action, entityType: e.entityType, entityId: e.entityId,
    actor: { userId: e.actorUserId, name: e.actorName },
    tenantId: e.tenantId || null, schoolId: e.schoolId || null,
    meta: safeMeta(e.metaJson), createdAt: e.createdAt.toISOString(),
  };
}

export async function listAuditEvents(params: AuditListParams): Promise<{ data: AuditEventDto[]; meta: { page: number; pageSize: number; total: number; totalPages: number } }> {
  const where: Prisma.AuditEventWhereInput = {};
  if (params.action) where.action = params.action;
  if (params.schoolId) where.schoolId = params.schoolId;
  if (params.actor) {
    where.OR = [{ actorUserId: params.actor }, { actorName: { contains: params.actor, mode: "insensitive" } }];
  }
  if (params.search) {
    const q = params.search.trim();
    where.AND = [{ OR: [{ action: { contains: q, mode: "insensitive" } }, { actorName: { contains: q, mode: "insensitive" } }, { entityType: { contains: q, mode: "insensitive" } }] }];
  }
  if (params.from || params.to) {
    where.createdAt = {};
    if (params.from) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(params.from);
    if (params.to) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(params.to);
  }

  const [rows, total] = await Promise.all([
    prisma.auditEvent.findMany({ where, orderBy: { createdAt: "desc" }, skip: (params.page - 1) * params.pageSize, take: params.pageSize }),
    prisma.auditEvent.count({ where }),
  ]);

  return {
    data: rows.map(toDto),
    meta: { page: params.page, pageSize: params.pageSize, total, totalPages: Math.max(1, Math.ceil(total / params.pageSize)) },
  };
}
