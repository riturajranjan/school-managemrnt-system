// Lightweight audit recorder (spec §30). Records important business actions into
// the AuditEvent table with ids + a small meta blob only — never bulky PII.
// Accepts a Prisma client OR a transaction client so it can participate in the
// same transaction as the action it records.
import type { Prisma } from "@/lib/generated/prisma/client";
import type { OrgScope } from "./scope";

export type AuditAction =
  | "STUDENT_CREATED"
  | "STUDENT_UPDATED"
  | "STUDENT_ARCHIVED"
  | "STUDENT_RESTORED"
  | "GUARDIAN_CREATED"
  | "GUARDIAN_UPDATED"
  | "GUARDIAN_LINKED"
  | "GUARDIAN_UNLINKED"
  | "ADMISSION_CREATED"
  | "ADMISSION_UPDATED"
  | "ADMISSION_STAGE_CHANGED"
  | "ADMISSION_APPROVED"
  | "ADMISSION_REJECTED"
  | "ADMISSION_CONVERTED"
  // Platform (Super Admin) actions — actor is a platform admin; tenantId/schoolId
  // point at the TARGET tenant/school, never the actor.
  | "SCHOOL_CREATED"
  | "SCHOOL_UPDATED"
  | "SCHOOL_SUSPENDED"
  | "SCHOOL_REACTIVATED"
  | "ONBOARDING_UPDATED"
  | "ONBOARDING_COMPLETED"
  | "TRIAL_EXTENDED"
  | "TRIAL_CONVERTED"
  | "TRIAL_ENDED"
  | "INVOICE_GENERATED"
  | "INVOICE_ISSUED"
  | "INVOICE_PAID"
  | "INVOICE_VOIDED";

export async function recordAudit(
  db: Prisma.TransactionClient,
  scope: OrgScope,
  action: AuditAction,
  entityType: string,
  entityId: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  await db.auditEvent.create({
    data: {
      tenantId: scope.tenantId,
      schoolId: scope.schoolId,
      actorUserId: scope.actor.id,
      actorName: scope.actor.name,
      action,
      entityType,
      entityId,
      metaJson: (meta as Prisma.InputJsonValue | undefined) ?? undefined,
    },
  });
}
