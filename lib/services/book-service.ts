import { getSnapshot, setState } from "@/lib/data/store";
import type { Book, BookCopy, BookStatus } from "@/lib/types/library";
import { moneyFromMinor } from "@/lib/finance/money";
import { generateId } from "@/lib/utils";
import { logResourceAudit } from "./resource-audit-service";

type Actor = { name: string; role: string };
type Result = { ok: true } | { ok: false; error: string };

export type BookDraft = Omit<Book, "id" | "status" | "archived" | "createdAt" | "updatedAt">;

/** Normalises an ISBN to bare digits/X so "978-0-14…" and "9780014…" compare
 * equal for duplicate detection. */
export function normalizeIsbn(isbn?: string): string {
  return (isbn ?? "").replace(/[^0-9Xx]/g, "").toUpperCase();
}

export function findDuplicateIsbn(isbn: string | undefined, excludeId?: string): Book | undefined {
  const key = normalizeIsbn(isbn);
  if (!key) return undefined;
  return getSnapshot().books.find((b) => b.id !== excludeId && !b.archived && normalizeIsbn(b.isbn) === key);
}

function isDuplicateAccession(accessionNumber: string, excludeId?: string): boolean {
  const key = accessionNumber.trim().toLowerCase();
  return getSnapshot().books.some((b) => b.id !== excludeId && b.accessionNumber.trim().toLowerCase() === key);
}

export function createBook(draft: BookDraft, actor: Actor, options?: { allowDuplicateIsbn?: boolean }): Result & { book?: Book } {
  if (isDuplicateAccession(draft.accessionNumber)) return { ok: false, error: `Accession number "${draft.accessionNumber}" is already in use.` };
  if (!options?.allowDuplicateIsbn) {
    const dupe = findDuplicateIsbn(draft.isbn);
    if (dupe) return { ok: false, error: `A book with this ISBN already exists: "${dupe.title}". Merge or confirm to continue.` };
  }

  const now = new Date().toISOString();
  const status: BookStatus = draft.referenceOnly ? "reference-only" : "available";
  const book: Book = { ...draft, id: generateId("book"), status, archived: false, createdAt: now, updatedAt: now };
  setState((db) => ({ ...db, books: [...db.books, book] }));
  logResourceAudit({ domain: "library", subjectId: book.id, action: "book-created", actorName: actor.name, actorRole: actor.role, summary: `Book "${book.title}" added to the catalogue.` });
  return { ok: true, book };
}

export function updateBook(bookId: string, patch: Partial<BookDraft>, actor: Actor): Result {
  const db = getSnapshot();
  const book = db.books.find((b) => b.id === bookId);
  if (!book) return { ok: false, error: "Book not found." };
  if (patch.accessionNumber && isDuplicateAccession(patch.accessionNumber, bookId)) return { ok: false, error: `Accession number "${patch.accessionNumber}" is already in use.` };

  const now = new Date().toISOString();
  setState((current) => ({ ...current, books: current.books.map((b) => (b.id === bookId ? { ...b, ...patch, updatedAt: now } : b)) }));
  logResourceAudit({ domain: "library", subjectId: bookId, action: "book-updated", actorName: actor.name, actorRole: actor.role, summary: `Book "${book.title}" updated.` });
  return { ok: true };
}

export function archiveBook(bookId: string, actor: Actor, reason?: string): Result {
  const db = getSnapshot();
  const book = db.books.find((b) => b.id === bookId);
  if (!book) return { ok: false, error: "Book not found." };
  const activeLoans = db.libraryLoans.some((l) => l.bookId === bookId && (l.status === "active" || l.status === "overdue" || l.status === "renewed"));
  if (activeLoans) return { ok: false, error: "Cannot archive a book with active loans. Return all copies first." };

  const now = new Date().toISOString();
  setState((current) => ({ ...current, books: current.books.map((b) => (b.id === bookId ? { ...b, archived: true, status: "archived", updatedAt: now } : b)) }));
  logResourceAudit({ domain: "library", subjectId: bookId, action: "book-archived", actorName: actor.name, actorRole: actor.role, summary: `Book "${book.title}" archived.`, reason });
  return { ok: true };
}

export type BookCopyDraft = {
  bookId: string;
  libraryId: string;
  shelfId?: string;
  condition?: BookCopy["condition"];
  vendorId?: string;
  purchasePriceMinor?: number;
  notes?: string;
};

let copyCounter = 0;

/** Adds a physical copy to a title, minting a unique accession suffix, barcode
 * and QR token. Barcodes/QR tokens are opaque identifiers — never personal
 * data — per the Phase 7 security requirement. */
export function addCopy(draft: BookCopyDraft, actor: Actor): Result & { copy?: BookCopy } {
  const db = getSnapshot();
  const book = db.books.find((b) => b.id === draft.bookId);
  if (!book) return { ok: false, error: "Book not found." };

  const existing = db.bookCopies.filter((c) => c.bookId === draft.bookId);
  const suffix = existing.length + 1;
  const now = new Date().toISOString();
  copyCounter += 1;
  const copy: BookCopy = {
    id: generateId("copy"),
    bookId: draft.bookId,
    libraryId: draft.libraryId,
    accessionNumber: `${book.accessionNumber}/${suffix}`,
    barcode: `LIBC${Date.now().toString(36).toUpperCase()}${copyCounter}`,
    qrToken: `qr_${generateId("t").slice(2)}`,
    acquisitionDate: now.slice(0, 10),
    purchasePrice: moneyFromMinor(draft.purchasePriceMinor ?? book.replacementCost.minorUnits, book.replacementCost.currency),
    vendorId: draft.vendorId,
    shelfId: draft.shelfId ?? book.shelfId,
    condition: draft.condition ?? "new",
    loanStatus: "on-shelf",
    lastStockCheck: now.slice(0, 10),
    replacementCost: book.replacementCost,
    notes: draft.notes,
    createdAt: now,
    updatedAt: now,
  };
  setState((current) => ({ ...current, bookCopies: [...current.bookCopies, copy] }));
  logResourceAudit({ domain: "library", subjectId: copy.id, action: "copy-added", actorName: actor.name, actorRole: actor.role, summary: `Copy ${copy.accessionNumber} added to "${book.title}".` });
  return { ok: true, copy };
}
