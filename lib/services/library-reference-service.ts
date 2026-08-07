import { setState } from "@/lib/data/store";
import type { Author, BookCategory, Publisher, Shelf } from "@/lib/types/library";
import { generateId } from "@/lib/utils";
import { logResourceAudit } from "./resource-audit-service";

type Actor = { name: string; role: string };

export function createAuthor(input: { name: string; nationality?: string; bio?: string }): Author {
  const author: Author = { id: generateId("author"), name: input.name.trim(), nationality: input.nationality, bio: input.bio, createdAt: new Date().toISOString() };
  setState((db) => ({ ...db, authors: [...db.authors, author] }));
  return author;
}

export function createPublisher(input: { name: string; city?: string; contactEmail?: string }): Publisher {
  const publisher: Publisher = { id: generateId("publisher"), name: input.name.trim(), city: input.city, contactEmail: input.contactEmail, createdAt: new Date().toISOString() };
  setState((db) => ({ ...db, publishers: [...db.publishers, publisher] }));
  return publisher;
}

export function createCategory(input: { name: string; classification?: string; colorTone?: BookCategory["colorTone"] }): BookCategory {
  const category: BookCategory = { id: generateId("bookcat"), name: input.name.trim(), classification: input.classification, colorTone: input.colorTone ?? "neutral", createdAt: new Date().toISOString() };
  setState((db) => ({ ...db, bookCategories: [...db.bookCategories, category] }));
  return category;
}

export function createShelf(input: { libraryId: string; code: string; label: string; path: string; capacity: number }, actor: Actor): Shelf {
  const now = new Date().toISOString();
  const shelf: Shelf = { id: generateId("shelf"), libraryId: input.libraryId, code: input.code.trim(), label: input.label.trim(), path: input.path, capacity: input.capacity, stocktakeStatus: "never", createdAt: now, updatedAt: now };
  setState((db) => ({ ...db, shelves: [...db.shelves, shelf] }));
  logResourceAudit({ domain: "library", subjectId: shelf.id, action: "book-updated", actorName: actor.name, actorRole: actor.role, summary: `Shelf ${shelf.code} created.` });
  return shelf;
}
