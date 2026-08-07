import { getSnapshot, setState } from "@/lib/data/store";
import type { LibraryMember } from "@/lib/types/library";
import { generateId } from "@/lib/utils";
import { logResourceAudit } from "./resource-audit-service";

type Actor = { name: string; role: string };
type Result = { ok: true } | { ok: false; error: string };

export type MemberDraft = Omit<LibraryMember, "id" | "status" | "cardBarcode" | "createdAt" | "updatedAt">;

let cardCounter = 0;

export function createMember(draft: MemberDraft, actor: Actor): Result & { member?: LibraryMember } {
  const db = getSnapshot();
  if (db.libraryMembers.some((m) => m.membershipId.toLowerCase() === draft.membershipId.trim().toLowerCase())) {
    return { ok: false, error: `Membership ID "${draft.membershipId}" is already in use.` };
  }
  const now = new Date().toISOString();
  cardCounter += 1;
  const member: LibraryMember = { ...draft, id: generateId("member"), status: "active", cardBarcode: `LIBM${Date.now().toString(36).toUpperCase()}${cardCounter}`, createdAt: now, updatedAt: now };
  setState((current) => ({ ...current, libraryMembers: [...current.libraryMembers, member] }));
  logResourceAudit({ domain: "library", subjectId: member.id, action: "member-created", actorName: actor.name, actorRole: actor.role, summary: `Library member ${member.name} (${member.membershipId}) created.` });
  return { ok: true, member };
}

export function updateMember(memberId: string, patch: Partial<MemberDraft>, actor: Actor): Result {
  const db = getSnapshot();
  const member = db.libraryMembers.find((m) => m.id === memberId);
  if (!member) return { ok: false, error: "Member not found." };
  const now = new Date().toISOString();
  setState((current) => ({ ...current, libraryMembers: current.libraryMembers.map((m) => (m.id === memberId ? { ...m, ...patch, updatedAt: now } : m)) }));
  logResourceAudit({ domain: "library", subjectId: memberId, action: "member-updated", actorName: actor.name, actorRole: actor.role, summary: `Member ${member.name} updated.` });
  return { ok: true };
}

export function suspendMember(memberId: string, actor: Actor, reason?: string): Result {
  const db = getSnapshot();
  const member = db.libraryMembers.find((m) => m.id === memberId);
  if (!member) return { ok: false, error: "Member not found." };
  const now = new Date().toISOString();
  setState((current) => ({ ...current, libraryMembers: current.libraryMembers.map((m) => (m.id === memberId ? { ...m, status: "suspended", updatedAt: now } : m)) }));
  logResourceAudit({ domain: "library", subjectId: memberId, action: "member-suspended", actorName: actor.name, actorRole: actor.role, summary: `Borrowing suspended for ${member.name}.`, reason });
  return { ok: true };
}

export function reinstateMember(memberId: string, actor: Actor): Result {
  const db = getSnapshot();
  const member = db.libraryMembers.find((m) => m.id === memberId);
  if (!member) return { ok: false, error: "Member not found." };
  const now = new Date().toISOString();
  setState((current) => ({ ...current, libraryMembers: current.libraryMembers.map((m) => (m.id === memberId ? { ...m, status: "active", updatedAt: now } : m)) }));
  logResourceAudit({ domain: "library", subjectId: memberId, action: "member-reinstated", actorName: actor.name, actorRole: actor.role, summary: `Borrowing reinstated for ${member.name}.` });
  return { ok: true };
}
