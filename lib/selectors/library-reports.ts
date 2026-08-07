import type { Db } from "@/lib/data/store";
import type { Book, DigitalResource, LibraryMember } from "@/lib/types/library";
import { availabilityForBook } from "./book-availability";

export type TitleStat = { book: Book; count: number };

/** Most-issued titles (all-time loan count), highest first. */
export function mostIssuedBooks(db: Db, limit = 8): TitleStat[] {
  const counts = new Map<string, number>();
  for (const loan of db.libraryLoans) counts.set(loan.bookId, (counts.get(loan.bookId) ?? 0) + 1);
  return rankBooks(db, counts, limit);
}

export function mostReservedBooks(db: Db, limit = 8): TitleStat[] {
  const counts = new Map<string, number>();
  for (const r of db.libraryReservations) counts.set(r.bookId, (counts.get(r.bookId) ?? 0) + 1);
  return rankBooks(db, counts, limit);
}

/** Titles under demand pressure — those with an active reservation queue and
 * no copies available now, i.e. candidates for buying more copies. */
export function titlesNeedingCopies(db: Db, limit = 8): { book: Book; queue: number }[] {
  const queueByBook = new Map<string, number>();
  for (const r of db.libraryReservations) {
    if (r.status === "waiting" || r.status === "ready") queueByBook.set(r.bookId, (queueByBook.get(r.bookId) ?? 0) + 1);
  }
  return [...queueByBook.entries()]
    .map(([bookId, queue]) => ({ book: db.books.find((b) => b.id === bookId), queue }))
    .filter((x): x is { book: Book; queue: number } => Boolean(x.book) && availabilityForBook(db, x.book!.id).available === 0)
    .sort((a, b) => b.queue - a.queue)
    .slice(0, limit);
}

/** Titles never issued — surfaced positively as "underused, worth promoting". */
export function underusedBooks(db: Db, limit = 8): Book[] {
  const issued = new Set(db.libraryLoans.map((l) => l.bookId));
  return db.books.filter((b) => !b.archived && !b.referenceOnly && !issued.has(b.id)).slice(0, limit);
}

export type ReaderStat = { member: LibraryMember; count: number };

/** Active readers by loan count. Deliberately NOT surfaced as a competitive
 * class ranking — used for positive engagement highlights only. */
export function activeReaders(db: Db, limit = 8): ReaderStat[] {
  const counts = new Map<string, number>();
  for (const loan of db.libraryLoans) counts.set(loan.memberId, (counts.get(loan.memberId) ?? 0) + 1);
  return [...counts.entries()]
    .map(([memberId, count]) => ({ member: db.libraryMembers.find((m) => m.id === memberId), count }))
    .filter((x): x is ReaderStat => Boolean(x.member))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export type SubjectInterest = { subject: string; count: number };

export function subjectInterest(db: Db): SubjectInterest[] {
  const counts = new Map<string, number>();
  for (const loan of db.libraryLoans) {
    const book = db.books.find((b) => b.id === loan.bookId);
    const subject = book?.subject ?? "Other";
    counts.set(subject, (counts.get(subject) ?? 0) + 1);
  }
  return [...counts.entries()].map(([subject, count]) => ({ subject, count })).sort((a, b) => b.count - a.count);
}

export type DigitalUsageStat = { resource: DigitalResource; views: number };

export function digitalUsage(db: Db, limit = 8): DigitalUsageStat[] {
  return [...db.digitalResources].sort((a, b) => b.viewCount - a.viewCount).slice(0, limit).map((resource) => ({ resource, views: resource.viewCount }));
}

function rankBooks(db: Db, counts: Map<string, number>, limit: number): TitleStat[] {
  return [...counts.entries()]
    .map(([bookId, count]) => ({ book: db.books.find((b) => b.id === bookId), count }))
    .filter((x): x is TitleStat => Boolean(x.book))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Smart recommendations (explainable, availability-aware)
// ---------------------------------------------------------------------------

export type Recommendation = { book: Book; reason: string };

/** Lightweight, explainable recommendations for a member: same subjects they
 * read, popular-in-class titles, and available-now picks. Never makes claims
 * about ability or personality — only observable signals with a stated reason. */
export function recommendationsForMember(db: Db, memberId: string, limit = 6): Recommendation[] {
  const member = db.libraryMembers.find((m) => m.id === memberId);
  if (!member) return [];
  const readBookIds = new Set(db.libraryLoans.filter((l) => l.memberId === memberId).map((l) => l.bookId));
  const readSubjects = new Set(
    db.libraryLoans
      .filter((l) => l.memberId === memberId)
      .map((l) => db.books.find((b) => b.id === l.bookId)?.subject)
      .filter(Boolean) as string[],
  );

  const out: Recommendation[] = [];
  const seen = new Set<string>();
  function add(book: Book | undefined, reason: string) {
    if (!book || readBookIds.has(book.id) || seen.has(book.id) || book.archived) return;
    if (availabilityForBook(db, book.id).available === 0) return;
    seen.add(book.id);
    out.push({ book, reason });
  }

  // Same subject as titles already read.
  for (const book of db.books) {
    if (out.length >= limit) break;
    if (book.subject && readSubjects.has(book.subject)) add(book, `Similar subject to books you've read (${book.subject})`);
  }
  // Popular titles available now.
  for (const { book } of mostIssuedBooks(db, 20)) {
    if (out.length >= limit) break;
    add(book, "Popular and available now");
  }
  return out.slice(0, limit);
}
