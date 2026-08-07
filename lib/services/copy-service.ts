import { getSnapshot, setState } from "@/lib/data/store";
import type { BookCopy, CopyCondition } from "@/lib/types/library";
import { generateId } from "@/lib/utils";
import { logResourceAudit } from "./resource-audit-service";

type Actor = { name: string; role: string };
type Result = { ok: true } | { ok: false; error: string };

function patchCopy(copyId: string, patch: Partial<BookCopy>) {
  const now = new Date().toISOString();
  setState((db) => ({ ...db, bookCopies: db.bookCopies.map((c) => (c.id === copyId ? { ...c, ...patch, updatedAt: now } : c)) }));
}

/** Moves a copy to a different shelf (optionally in another library). Blocked
 * while the copy is on loan so a transfer can't strand an active borrower. */
export function transferCopy(copyId: string, target: { shelfId?: string; libraryId?: string }, actor: Actor, reason?: string): Result {
  const db = getSnapshot();
  const copy = db.bookCopies.find((c) => c.id === copyId);
  if (!copy) return { ok: false, error: "Copy not found." };
  if (copy.loanStatus === "issued") return { ok: false, error: "Cannot transfer a copy that is currently issued." };

  patchCopy(copyId, { shelfId: target.shelfId ?? copy.shelfId, libraryId: target.libraryId ?? copy.libraryId });
  logResourceAudit({ domain: "library", subjectId: copyId, action: "copy-transferred", actorName: actor.name, actorRole: actor.role, summary: `Copy ${copy.accessionNumber} transferred.`, reason });
  return { ok: true };
}

export function setCopyCondition(copyId: string, condition: CopyCondition, actor: Actor, reason?: string): Result {
  const db = getSnapshot();
  const copy = db.bookCopies.find((c) => c.id === copyId);
  if (!copy) return { ok: false, error: "Copy not found." };

  const loanStatus = condition === "lost" ? "lost" : condition === "under-repair" ? copy.loanStatus : copy.loanStatus;
  patchCopy(copyId, { condition, loanStatus });
  const action = condition === "lost" ? "copy-marked-lost" : condition === "damaged" ? "copy-marked-damaged" : condition === "under-repair" ? "copy-updated" : "copy-repaired";
  logResourceAudit({ domain: "library", subjectId: copyId, action, actorName: actor.name, actorRole: actor.role, summary: `Copy ${copy.accessionNumber} marked ${condition}.`, previousValue: copy.condition, newValue: condition, reason });
  return { ok: true };
}

/** Permanently retires a copy from circulation (kept in history, never
 * hard-deleted). Blocked while issued. */
export function withdrawCopy(copyId: string, actor: Actor, reason?: string): Result {
  const db = getSnapshot();
  const copy = db.bookCopies.find((c) => c.id === copyId);
  if (!copy) return { ok: false, error: "Copy not found." };
  if (copy.loanStatus === "issued") return { ok: false, error: "Cannot withdraw a copy that is currently issued." };

  patchCopy(copyId, { loanStatus: "withdrawn" });
  logResourceAudit({ domain: "library", subjectId: copyId, action: "copy-withdrawn", actorName: actor.name, actorRole: actor.role, summary: `Copy ${copy.accessionNumber} withdrawn.`, reason });
  return { ok: true };
}

export function recordStockCheck(copyId: string, foundShelfId: string | undefined): Result {
  const db = getSnapshot();
  const copy = db.bookCopies.find((c) => c.id === copyId);
  if (!copy) return { ok: false, error: "Copy not found." };
  patchCopy(copyId, { lastStockCheck: new Date().toISOString().slice(0, 10), shelfId: foundShelfId ?? copy.shelfId });
  return { ok: true };
}

export type ManualCopyDraft = Omit<BookCopy, "id" | "createdAt" | "updatedAt">;

export function importCopy(draft: ManualCopyDraft, actor: Actor): BookCopy {
  const now = new Date().toISOString();
  const copy: BookCopy = { ...draft, id: generateId("copy"), createdAt: now, updatedAt: now };
  setState((db) => ({ ...db, bookCopies: [...db.bookCopies, copy] }));
  logResourceAudit({ domain: "library", subjectId: copy.id, action: "copy-added", actorName: actor.name, actorRole: actor.role, summary: `Copy ${copy.accessionNumber} imported.` });
  return copy;
}
