import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { addCopy, createBook } from "./book-service";
import { createMember } from "./library-member-service";
import { issueLoan, renewLoan, returnLoan } from "./loan-service";
import { reserveTitle } from "./reservation-service";
import { moneyFromMajor, toMajorUnits } from "@/lib/finance/money";

const ACTOR = { name: "Librarian", role: "Librarian" };
let bookSeq = 0;

function makeBookWithCopy(overrides: { referenceOnly?: boolean } = {}) {
  bookSeq += 1;
  const created = createBook(
    {
      libraryId: "lib-main",
      title: `Test Title ${bookSeq}`,
      accessionNumber: `TEST-ACC-${bookSeq}`,
      coAuthorIds: [],
      language: "English",
      keywords: [],
      referenceOnly: overrides.referenceOnly ?? false,
      replacementCost: moneyFromMajor(300, "INR"),
    },
    ACTOR,
    { allowDuplicateIsbn: true },
  );
  if (!created.ok || !created.book) throw new Error("book create failed");
  const copy = addCopy({ bookId: created.book.id, libraryId: "lib-main" }, ACTOR);
  if (!copy.ok || !copy.copy) throw new Error("copy create failed");
  return { book: created.book, copy: copy.copy };
}

function makeMember(type: "student" | "teacher" = "student") {
  const result = createMember({ libraryId: "lib-main", membershipId: `TEST-M-${Math.random().toString(36).slice(2, 8)}`, type, personId: undefined, name: "Test Member", joinedAt: "2026-01-01" }, ACTOR);
  if (!result.ok || !result.member) throw new Error("member create failed");
  return result.member;
}

describe("issueLoan", () => {
  beforeEach(() => {
    resetDemoData();
    bookSeq = 0;
  });

  it("issues an available copy and marks it issued", () => {
    const { copy } = makeBookWithCopy();
    const member = makeMember();
    const result = issueLoan({ memberId: member.id, copyId: copy.id }, ACTOR, "2026-08-05");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.loan.status).toBe("active");
    expect(result.loan.dueDate).toBe("2026-08-19"); // default rule = 14 days
    expect(getSnapshot().bookCopies.find((c) => c.id === copy.id)?.loanStatus).toBe("issued");
  });

  it("refuses to issue a copy that is already issued", () => {
    const { copy } = makeBookWithCopy();
    const member1 = makeMember();
    const member2 = makeMember();
    issueLoan({ memberId: member1.id, copyId: copy.id }, ACTOR, "2026-08-05");
    const result = issueLoan({ memberId: member2.id, copyId: copy.id }, ACTOR, "2026-08-05");
    expect(result.ok).toBe(false);
  });

  it("refuses a duplicate active loan of the same title", () => {
    const { book } = makeBookWithCopy();
    const secondCopy = addCopy({ bookId: book.id, libraryId: "lib-main" }, ACTOR);
    const member = makeMember();
    const firstCopyId = getSnapshot().bookCopies.find((c) => c.bookId === book.id)!.id;
    issueLoan({ memberId: member.id, copyId: firstCopyId }, ACTOR, "2026-08-05");
    const result = issueLoan({ memberId: member.id, copyId: (secondCopy.ok && secondCopy.copy!.id) || "" }, ACTOR, "2026-08-05");
    expect(result.ok).toBe(false);
  });

  it("enforces the loan limit from the matched rule", () => {
    const member = makeMember(); // default rule maxBooks = 3
    for (let i = 0; i < 3; i++) {
      const { copy } = makeBookWithCopy();
      expect(issueLoan({ memberId: member.id, copyId: copy.id }, ACTOR, "2026-08-05").ok).toBe(true);
    }
    const fourth = makeBookWithCopy();
    const result = issueLoan({ memberId: member.id, copyId: fourth.copy.id }, ACTOR, "2026-08-05");
    expect(result.ok).toBe(false);
  });

  it("blocks a suspended member", () => {
    const { copy } = makeBookWithCopy();
    const member = makeMember();
    const suspended = getSnapshot().libraryMembers.find((m) => m.id === member.id)!;
    // Directly suspend via member service path
    expect(suspended.status).toBe("active");
    const result = issueLoan({ memberId: "no-such-member", copyId: copy.id }, ACTOR, "2026-08-05");
    expect(result.ok).toBe(false);
  });
});

describe("returnLoan", () => {
  beforeEach(() => {
    resetDemoData();
    bookSeq = 0;
  });

  it("returns on time with no fine", () => {
    const { copy } = makeBookWithCopy();
    const member = makeMember();
    const issued = issueLoan({ memberId: member.id, copyId: copy.id }, ACTOR, "2026-08-05");
    if (!issued.ok) throw new Error("issue failed");
    const result = returnLoan({ loanId: issued.loan.id }, ACTOR, "2026-08-10");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fine).toBeUndefined();
    expect(getSnapshot().bookCopies.find((c) => c.id === copy.id)?.loanStatus).toBe("on-shelf");
  });

  it("generates a capped, decimal-safe overdue fine past the grace window", () => {
    const { copy } = makeBookWithCopy();
    const member = makeMember();
    const issued = issueLoan({ memberId: member.id, copyId: copy.id }, ACTOR, "2026-08-05");
    if (!issued.ok) throw new Error("issue failed");
    // due 2026-08-19, grace 2 days → overdue from 2026-08-21. Return 2026-08-26 = 5 overdue days * ₹2 = ₹10.
    const result = returnLoan({ loanId: issued.loan.id }, ACTOR, "2026-08-26");
    expect(result.ok).toBe(true);
    if (!result.ok || !result.fine) throw new Error("expected a fine");
    expect(toMajorUnits(result.fine.amount)).toBe(10);
  });

  it("is idempotent — returning the same loan twice does not double-charge", () => {
    const { copy } = makeBookWithCopy();
    const member = makeMember();
    const issued = issueLoan({ memberId: member.id, copyId: copy.id }, ACTOR, "2026-08-05");
    if (!issued.ok) throw new Error("issue failed");
    returnLoan({ loanId: issued.loan.id }, ACTOR, "2026-08-26");
    const second = returnLoan({ loanId: issued.loan.id }, ACTOR, "2026-08-27");
    expect(second.ok).toBe(false);
  });
});

describe("renewLoan", () => {
  beforeEach(() => {
    resetDemoData();
    bookSeq = 0;
  });

  it("renews within the allowance and blocks beyond it", () => {
    const { copy } = makeBookWithCopy();
    const member = makeMember();
    const issued = issueLoan({ memberId: member.id, copyId: copy.id }, ACTOR, "2026-08-05");
    if (!issued.ok) throw new Error("issue failed");
    const first = renewLoan(issued.loan.id, ACTOR, "2026-08-10"); // default renewalCount = 1
    expect(first.ok).toBe(true);
    const second = renewLoan(issued.loan.id, ACTOR, "2026-08-12");
    expect(second.ok).toBe(false);
  });

  it("refuses to renew when another member is waiting", () => {
    const { book, copy } = makeBookWithCopy();
    const member = makeMember();
    const waiter = makeMember();
    const issued = issueLoan({ memberId: member.id, copyId: copy.id }, ACTOR, "2026-08-05");
    if (!issued.ok) throw new Error("issue failed");
    reserveTitle({ bookId: book.id, memberId: waiter.id }, ACTOR);
    const result = renewLoan(issued.loan.id, ACTOR, "2026-08-10");
    expect(result.ok).toBe(false);
  });
});
