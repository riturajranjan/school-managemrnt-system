import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { PrismaTx } from "./tx";

// ---------------------------------------------------------------------------
// Audit foundation. Append-only writes to AuditEvent. Pass the transaction
// client (tx) when the audit must commit atomically with the change it records.
// NEVER put secrets (passwords, tokens) in `metadata`.
// ---------------------------------------------------------------------------

export type AuditInput = {
  tenantId?: string | null;
  actorUserId?: string | null;
  action: string; // e.g. "school.created", "membership.role.assigned"
  entityType: string; // e.g. "School"
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
};

export async function recordAudit(input: AuditInput, client: PrismaTx = prisma): Promise<void> {
  await client.auditEvent.create({
    data: {
      tenantId: input.tenantId ?? null,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: (input.metadata as object) ?? undefined,
      ipAddress: input.ipAddress ?? null,
    },
  });
}
