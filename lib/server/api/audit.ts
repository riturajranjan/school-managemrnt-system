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
  | "INVOICE_VOIDED"
  | "PAYMENT_RECORDED"
  | "PAYMENT_REVERSED"
  | "SUPPORT_TICKET_CREATED"
  | "SUPPORT_TICKET_ASSIGNED"
  | "SUPPORT_TICKET_STATUS_CHANGED"
  | "SUPPORT_MESSAGE_ADDED"
  | "SUPPORT_NOTE_ADDED"
  | "IMPERSONATION_STARTED"
  | "IMPERSONATION_ENDED"
  | "FEATURE_OVERRIDE_SET"
  | "FEATURE_OVERRIDE_CLEARED"
  | "DOMAIN_ADDED"
  | "DOMAIN_STATUS_CHANGED"
  | "DOMAIN_REMOVED"
  | "BRANDING_UPDATED"
  | "ADDON_CREATED"
  | "ADDON_UPDATED"
  | "ADDON_STATUS_CHANGED"
  | "ADDON_ASSIGNED"
  | "ADDON_REMOVED"
  | "MARKETPLACE_APP_CREATED"
  | "MARKETPLACE_APP_UPDATED"
  | "MARKETPLACE_APP_STATUS_CHANGED"
  | "MARKETPLACE_APP_INSTALLED"
  | "MARKETPLACE_APP_DISABLED"
  | "PLATFORM_SETTINGS_UPDATED"
  | "PLATFORM_ADMIN_INVITED"
  | "PLATFORM_ADMIN_UPDATED"
  | "PLATFORM_ADMIN_STATUS_CHANGED"
  | "ANNOUNCEMENT_CREATED"
  | "ANNOUNCEMENT_UPDATED"
  | "ANNOUNCEMENT_PUBLISHED"
  | "ANNOUNCEMENT_ARCHIVED"
  | "PLATFORM_INCIDENT_CREATED"
  | "PLATFORM_INCIDENT_UPDATED"
  | "PLATFORM_INCIDENT_RESOLVED"
  | "CLASS_CREATED"
  | "CLASS_UPDATED"
  | "SECTION_CREATED"
  | "SECTION_UPDATED"
  | "STUDENT_ENROLLED"
  | "STUDENT_UNENROLLED"
  | "ATTENDANCE_SESSION_CREATED"
  | "ATTENDANCE_UPDATED"
  | "ATTENDANCE_SUBMITTED"
  | "ATTENDANCE_LOCKED";

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
