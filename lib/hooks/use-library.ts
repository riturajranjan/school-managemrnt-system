"use client";

import { useMemo } from "react";
import { useSisStore } from "./use-store";
import { availabilityForBook } from "@/lib/selectors/book-availability";

export function useLibraries() {
  return useSisStore().libraries;
}

export function useLibrary(libraryId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.libraries.find((l) => l.id === libraryId), [db.libraries, libraryId]);
}

export function useBooks() {
  return useSisStore().books;
}

export function useBook(bookId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.books.find((b) => b.id === bookId), [db.books, bookId]);
}

export function useBookCopies(bookId?: string) {
  const db = useSisStore();
  return useMemo(() => (bookId ? db.bookCopies.filter((c) => c.bookId === bookId) : db.bookCopies), [db.bookCopies, bookId]);
}

export function useBookAvailability(bookId: string) {
  const db = useSisStore();
  return useMemo(() => availabilityForBook(db, bookId), [db, bookId]);
}

export function useLibraryMembers() {
  return useSisStore().libraryMembers;
}

export function useLibraryMember(memberId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.libraryMembers.find((m) => m.id === memberId), [db.libraryMembers, memberId]);
}

export function useLoans(filter?: { memberId?: string; bookId?: string; activeOnly?: boolean }) {
  const db = useSisStore();
  const memberId = filter?.memberId;
  const bookId = filter?.bookId;
  const activeOnly = filter?.activeOnly;
  return useMemo(
    () =>
      db.libraryLoans.filter(
        (l) =>
          (!memberId || l.memberId === memberId) &&
          (!bookId || l.bookId === bookId) &&
          (!activeOnly || l.status === "active" || l.status === "overdue" || l.status === "renewed"),
      ),
    [db.libraryLoans, memberId, bookId, activeOnly],
  );
}

export function useReservations(bookId?: string) {
  const db = useSisStore();
  return useMemo(() => (bookId ? db.libraryReservations.filter((r) => r.bookId === bookId) : db.libraryReservations), [db.libraryReservations, bookId]);
}

export function useFines(memberId?: string) {
  const db = useSisStore();
  return useMemo(() => (memberId ? db.libraryFines.filter((f) => f.memberId === memberId) : db.libraryFines), [db.libraryFines, memberId]);
}

export function useDigitalResources() {
  return useSisStore().digitalResources;
}

export function useDigitalResource(resourceId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.digitalResources.find((r) => r.id === resourceId), [db.digitalResources, resourceId]);
}

export function useShelves(libraryId?: string) {
  const db = useSisStore();
  return useMemo(() => (libraryId ? db.shelves.filter((s) => s.libraryId === libraryId) : db.shelves), [db.shelves, libraryId]);
}

export function useAuthors() {
  return useSisStore().authors;
}

export function usePublishers() {
  return useSisStore().publishers;
}

export function useBookCategories() {
  return useSisStore().bookCategories;
}

export function useLibraryRules() {
  return useSisStore().libraryRules;
}

export function useLibraryStocktakes() {
  return useSisStore().libraryStocktakes;
}

export function useResourceAudit(domain?: "library" | "inventory" | "asset", subjectId?: string) {
  const db = useSisStore();
  return useMemo(() => {
    let rows = db.resourceAuditLog;
    if (domain) rows = rows.filter((e) => e.domain === domain);
    if (subjectId) rows = rows.filter((e) => e.subjectId === subjectId);
    return rows;
  }, [db.resourceAuditLog, domain, subjectId]);
}
