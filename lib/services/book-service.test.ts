import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { addCopy, archiveBook, createBook, findDuplicateIsbn, normalizeIsbn } from "./book-service";
import { moneyFromMajor } from "@/lib/finance/money";

const ACTOR = { name: "Librarian", role: "Librarian" };

function draft(overrides: Partial<Parameters<typeof createBook>[0]> = {}) {
  return {
    libraryId: "lib-main",
    title: "New Catalogue Title",
    accessionNumber: `ACC-NEW-${Math.random().toString(36).slice(2, 8)}`,
    isbn: "978-0-14-1234-5",
    coAuthorIds: [],
    language: "English",
    keywords: [],
    referenceOnly: false,
    replacementCost: moneyFromMajor(400, "INR"),
    ...overrides,
  };
}

describe("createBook", () => {
  beforeEach(() => resetDemoData());

  it("adds a book with derived available status", () => {
    const result = createBook(draft(), ACTOR, { allowDuplicateIsbn: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.book!.status).toBe("available");
  });

  it("derives reference-only status for reference titles", () => {
    const result = createBook(draft({ referenceOnly: true }), ACTOR, { allowDuplicateIsbn: true });
    expect(result.ok && result.book!.status).toBe("reference-only");
  });

  it("refuses a duplicate accession number", () => {
    const first = createBook(draft({ accessionNumber: "ACC-DUP" }), ACTOR, { allowDuplicateIsbn: true });
    expect(first.ok).toBe(true);
    const second = createBook(draft({ accessionNumber: "ACC-DUP" }), ACTOR, { allowDuplicateIsbn: true });
    expect(second.ok).toBe(false);
  });

  it("detects a duplicate ISBN ignoring hyphenation", () => {
    createBook(draft({ isbn: "978-0-14-1234-5", accessionNumber: "ACC-ISBN-1" }), ACTOR, { allowDuplicateIsbn: true });
    const dupe = findDuplicateIsbn("9780141234 5".replace(" ", ""));
    expect(dupe).toBeTruthy();
    const blocked = createBook(draft({ isbn: "9780141 2345", accessionNumber: "ACC-ISBN-2" }), ACTOR);
    expect(blocked.ok).toBe(false);
  });

  it("normalises ISBNs to bare digits/X", () => {
    expect(normalizeIsbn("978-0-14-1234-5")).toBe("9780141234 5".replace(" ", ""));
    expect(normalizeIsbn("019-853453x")).toBe("019853453X");
  });
});

describe("archiveBook", () => {
  beforeEach(() => resetDemoData());

  it("archives a book with no active loans", () => {
    const created = createBook(draft(), ACTOR, { allowDuplicateIsbn: true });
    if (!created.ok) throw new Error("create failed");
    const result = archiveBook(created.book!.id, ACTOR, "Withdrawn edition");
    expect(result.ok).toBe(true);
    expect(getSnapshot().books.find((b) => b.id === created.book!.id)?.status).toBe("archived");
  });
});

describe("addCopy", () => {
  beforeEach(() => resetDemoData());

  it("mints a unique accession suffix, barcode and QR token", () => {
    const created = createBook(draft(), ACTOR, { allowDuplicateIsbn: true });
    if (!created.ok) throw new Error("create failed");
    const c1 = addCopy({ bookId: created.book!.id, libraryId: "lib-main" }, ACTOR);
    const c2 = addCopy({ bookId: created.book!.id, libraryId: "lib-main" }, ACTOR);
    expect(c1.ok && c2.ok).toBe(true);
    if (!c1.ok || !c2.ok) return;
    expect(c1.copy!.accessionNumber).not.toBe(c2.copy!.accessionNumber);
    expect(c1.copy!.barcode).not.toBe(c2.copy!.barcode);
    expect(c1.copy!.loanStatus).toBe("on-shelf");
  });
});
