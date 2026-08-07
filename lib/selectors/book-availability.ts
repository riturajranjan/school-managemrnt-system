import type { Db } from "@/lib/data/store";
import type { BookAvailability, BookCopy, BookStatus } from "@/lib/types/library";

/** Availability rollup for a title, computed live from its copies — never
 * stored, so it can't drift from the copy ledger. */
export function computeAvailability(copies: BookCopy[]): BookAvailability {
  const active = copies.filter((c) => c.loanStatus !== "withdrawn");
  return {
    total: active.length,
    available: active.filter((c) => c.loanStatus === "on-shelf" && c.condition !== "lost" && c.condition !== "damaged").length,
    issued: active.filter((c) => c.loanStatus === "issued").length,
    reserved: active.filter((c) => c.loanStatus === "reserved").length,
    lost: active.filter((c) => c.condition === "lost").length,
    damaged: active.filter((c) => c.condition === "damaged").length,
  };
}

export function availabilityForBook(db: Db, bookId: string): BookAvailability {
  return computeAvailability(db.bookCopies.filter((c) => c.bookId === bookId));
}

/** Derives the display status of a title from its copies + reference flag.
 * `archived` and explicit `digital-only` are respected as-is; everything else
 * is recomputed so the badge always matches reality. */
export function deriveBookStatus(current: BookStatus, referenceOnly: boolean, availability: BookAvailability): BookStatus {
  if (current === "archived") return "archived";
  if (current === "digital-only") return "digital-only";
  if (referenceOnly) return "reference-only";
  if (availability.total === 0) return availability.lost > 0 ? "lost" : "digital-only";
  if (availability.available === 0) return availability.reserved > 0 ? "reserved" : "fully-issued";
  if (availability.available <= 1) return "limited";
  return "available";
}
