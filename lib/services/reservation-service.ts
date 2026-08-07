import { getSnapshot, setState } from "@/lib/data/store";
import type { Db } from "@/lib/data/store";
import type { LibraryReservation } from "@/lib/types/library";
import { addDays } from "@/lib/selectors/library-loan-rules";
import { generateId } from "@/lib/utils";
import { logResourceAudit } from "./resource-audit-service";

type Actor = { name: string; role: string };
type Result = { ok: true } | { ok: false; error: string };

const PICKUP_WINDOW_DAYS = 3;

/** Live queue for a title, ordered by priority then position — the canonical
 * ordering used everywhere so the queue is never silently reordered. */
export function reservationQueue(db: Db, bookId: string): LibraryReservation[] {
  return db.libraryReservations
    .filter((r) => r.bookId === bookId && (r.status === "waiting" || r.status === "ready"))
    .sort((a, b) => b.priority - a.priority || a.queuePosition - b.queuePosition);
}

export function reserveTitle(input: { bookId: string; memberId: string; copyId?: string }, actor: Actor): Result & { reservation?: LibraryReservation } {
  const db = getSnapshot();
  const book = db.books.find((b) => b.id === input.bookId);
  if (!book) return { ok: false, error: "Book not found." };
  const member = db.libraryMembers.find((m) => m.id === input.memberId);
  if (!member) return { ok: false, error: "Member not found." };
  if (member.status !== "active") return { ok: false, error: `Member is ${member.status} and cannot reserve.` };
  if (db.libraryReservations.some((r) => r.bookId === input.bookId && r.memberId === input.memberId && (r.status === "waiting" || r.status === "ready"))) {
    return { ok: false, error: "This member already has an active reservation for this title." };
  }

  const queue = reservationQueue(db, input.bookId);
  const now = new Date().toISOString();
  const reservation: LibraryReservation = {
    id: generateId("resv"),
    libraryId: book.libraryId,
    bookId: input.bookId,
    copyId: input.copyId,
    memberId: input.memberId,
    queuePosition: queue.length + 1,
    priority: member.type === "teacher" ? 1 : 0,
    status: "waiting",
    pickupLibraryId: book.libraryId,
    reservedAt: now,
    notified: false,
    createdAt: now,
    updatedAt: now,
  };
  setState((current) => ({ ...current, libraryReservations: [...current.libraryReservations, reservation] }));
  logResourceAudit({ domain: "library", subjectId: reservation.id, action: "reservation-created", actorName: actor.name, actorRole: actor.role, summary: `${member.name} reserved "${book.title}" (queue position ${reservation.queuePosition}).` });
  return { ok: true, reservation };
}

export function cancelReservation(reservationId: string, actor: Actor, reason?: string): Result {
  const db = getSnapshot();
  const reservation = db.libraryReservations.find((r) => r.id === reservationId);
  if (!reservation) return { ok: false, error: "Reservation not found." };
  const now = new Date().toISOString();
  setState((current) => ({ ...current, libraryReservations: current.libraryReservations.map((r) => (r.id === reservationId ? { ...r, status: "cancelled", cancelledAt: now, updatedAt: now } : r)) }));
  logResourceAudit({ domain: "library", subjectId: reservationId, action: "reservation-cancelled", actorName: actor.name, actorRole: actor.role, summary: `Reservation cancelled.`, reason });
  reReserveQueuePositions(reservation.bookId);
  return { ok: true };
}

/** Called when a copy of a reserved title is returned. Promotes the highest-
 * priority waiting member to "ready", sets a pickup deadline and flags a
 * notification. Never skips queue order (priority-then-position). */
export function fulfilNextReservation(bookId: string, actor: Actor): void {
  const db = getSnapshot();
  const queue = reservationQueue(db, bookId);
  const alreadyReady = queue.some((r) => r.status === "ready");
  if (alreadyReady) return; // Only one ready at a time until collected.
  const next = queue.find((r) => r.status === "waiting");
  if (!next) return;

  const book = db.books.find((b) => b.id === bookId);
  const member = db.libraryMembers.find((m) => m.id === next.memberId);
  const now = new Date().toISOString();
  setState((current) => ({
    ...current,
    libraryReservations: current.libraryReservations.map((r) => (r.id === next.id ? { ...r, status: "ready", readyAt: now, expiresAt: addDays(now, PICKUP_WINDOW_DAYS), notified: true, updatedAt: now } : r)),
  }));
  logResourceAudit({ domain: "library", subjectId: next.id, action: "reservation-ready", actorName: actor.name, actorRole: actor.role, summary: `"${book?.title ?? bookId}" ready for pickup — ${member?.name ?? next.memberId} notified.` });
}

/** Compacts queue positions after a cancellation/expiry so positions stay 1..n. */
function reReserveQueuePositions(bookId: string): void {
  const db = getSnapshot();
  const active = reservationQueue(db, bookId);
  const now = new Date().toISOString();
  setState((current) => ({
    ...current,
    libraryReservations: current.libraryReservations.map((r) => {
      const idx = active.findIndex((a) => a.id === r.id);
      return idx >= 0 ? { ...r, queuePosition: idx + 1, updatedAt: now } : r;
    }),
  }));
}

export function expireReservation(reservationId: string, actor: Actor): Result {
  const db = getSnapshot();
  const reservation = db.libraryReservations.find((r) => r.id === reservationId);
  if (!reservation) return { ok: false, error: "Reservation not found." };
  const now = new Date().toISOString();
  setState((current) => ({ ...current, libraryReservations: current.libraryReservations.map((r) => (r.id === reservationId ? { ...r, status: "expired", updatedAt: now } : r)) }));
  reReserveQueuePositions(reservation.bookId);
  fulfilNextReservation(reservation.bookId, actor);
  return { ok: true };
}
