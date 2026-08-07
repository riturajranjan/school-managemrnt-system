import { getSnapshot, setState } from "@/lib/data/store";
import type { AccessLevel, DigitalResource, DigitalResourceAccess, MemberType } from "@/lib/types/library";
import { generateId } from "@/lib/utils";
import { logResourceAudit } from "./resource-audit-service";

type Actor = { name: string; role: string };
type Result = { ok: true } | { ok: false; error: string };

export type DigitalResourceDraft = Omit<DigitalResource, "id" | "version" | "viewCount" | "brokenLinkReported" | "publishedAt" | "createdAt" | "updatedAt">;

export function uploadDigitalResource(draft: DigitalResourceDraft, actor: Actor): Result & { resource?: DigitalResource } {
  if (!draft.fileUrl && !draft.externalUrl) return { ok: false, error: "Provide a file or an external URL." };
  const now = new Date().toISOString();
  const resource: DigitalResource = { ...draft, id: generateId("digital"), version: 1, viewCount: 0, brokenLinkReported: false, publishedAt: now, createdAt: now, updatedAt: now };
  setState((db) => ({ ...db, digitalResources: [resource, ...db.digitalResources] }));
  logResourceAudit({ domain: "library", subjectId: resource.id, action: "digital-uploaded", actorName: actor.name, actorRole: actor.role, summary: `Digital resource "${resource.title}" published.` });
  return { ok: true, resource };
}

export function updateDigitalResource(resourceId: string, patch: Partial<DigitalResourceDraft>, actor: Actor, options?: { newVersion?: boolean }): Result {
  const db = getSnapshot();
  const resource = db.digitalResources.find((r) => r.id === resourceId);
  if (!resource) return { ok: false, error: "Resource not found." };
  const now = new Date().toISOString();
  setState((current) => ({ ...current, digitalResources: current.digitalResources.map((r) => (r.id === resourceId ? { ...r, ...patch, version: options?.newVersion ? r.version + 1 : r.version, updatedAt: now } : r)) }));
  logResourceAudit({ domain: "library", subjectId: resourceId, action: "digital-updated", actorName: actor.name, actorRole: actor.role, summary: `Digital resource "${resource.title}" updated${options?.newVersion ? ` to v${resource.version + 1}` : ""}.` });
  return { ok: true };
}

/** Whether a member of `memberType` (with optional class/role context) may open
 * a resource. Central so UI gating and download buttons share one rule. */
export function canAccessResource(resource: DigitalResource, ctx: { memberType: MemberType; classOrDept?: string; role?: string }): boolean {
  const level: AccessLevel = resource.accessLevel;
  switch (level) {
    case "public":
      return true;
    case "students":
      return ctx.memberType === "student";
    case "teachers":
      return ctx.memberType === "teacher";
    case "staff":
      return ctx.memberType === "staff" || ctx.memberType === "teacher";
    case "class":
      return !resource.accessTarget || resource.accessTarget === ctx.classOrDept;
    case "subject":
      return true; // Subject targeting is advisory; enforced at browse level.
    case "role":
      return !resource.accessTarget || resource.accessTarget === ctx.role;
    default:
      return false;
  }
}

export function recordAccess(resourceId: string, memberId: string, action: DigitalResourceAccess["action"]): void {
  const now = new Date().toISOString();
  const event: DigitalResourceAccess = { id: generateId("dra"), resourceId, memberId, action, at: now };
  setState((db) => ({
    ...db,
    digitalResourceAccess: [event, ...db.digitalResourceAccess].slice(0, 5000),
    digitalResources: action === "view" || action === "read" || action === "stream" ? db.digitalResources.map((r) => (r.id === resourceId ? { ...r, viewCount: r.viewCount + 1 } : r)) : db.digitalResources,
  }));
}

export function reportBrokenLink(resourceId: string, actor: Actor): Result {
  const db = getSnapshot();
  const resource = db.digitalResources.find((r) => r.id === resourceId);
  if (!resource) return { ok: false, error: "Resource not found." };
  setState((current) => ({ ...current, digitalResources: current.digitalResources.map((r) => (r.id === resourceId ? { ...r, brokenLinkReported: true } : r)) }));
  logResourceAudit({ domain: "library", subjectId: resourceId, action: "digital-updated", actorName: actor.name, actorRole: actor.role, summary: `Broken link reported for "${resource.title}".` });
  return { ok: true };
}
