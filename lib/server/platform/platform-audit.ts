// Shared audit scope for PLATFORM-LEVEL actions (Super Admin System, SA-4N).
// Settings / admins / announcements / incidents have no tenant or school, so the
// AuditEvent's tenantId/schoolId are empty strings (the column is a plain String
// with no FK). The actor is always the real platform admin performing the action.
import type { OrgScope } from "@/lib/server/api/scope";

export type PlatformActor = { id: string; name: string | null };

export function platformScope(actor: PlatformActor): OrgScope {
  return { tenantId: "", schoolId: "", branchId: null, academicSessionId: null, actor: { id: actor.id, name: actor.name } };
}
