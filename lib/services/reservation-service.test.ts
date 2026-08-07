import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { addCopy, createBook } from "./book-service";
import { createMember } from "./library-member-service";
import { issueLoan, returnLoan } from "./loan-service";
import { cancelReservation, reservationQueue, reserveTitle } from "./reservation-service";
import { moneyFromMajor } from "@/lib/finance/money";

const ACTOR = { name: "Librarian", role: "Librarian" };
let seq = 0;

function makeBookWithCopy() {
  seq += 1;
  const created = createBook({ libraryId: "lib-main", title: `Resv Title ${seq}`, accessionNumber: `RESV-ACC-${seq}`, coAuthorIds: [], language: "English", keywords: [], referenceOnly: false, replacementCost: moneyFromMajor(300, "INR") }, ACTOR, { allowDuplicateIsbn: true });
  if (!created.ok || !created.book) throw new Error("book failed");
  const copy = addCopy({ bookId: created.book.id, libraryId: "lib-main" }, ACTOR);
  if (!copy.ok || !copy.copy) throw new Error("copy failed");
  return { book: created.book, copy: copy.copy };
}

function makeMember(type: "student" | "teacher" = "student") {
  const r = createMember({ libraryId: "lib-main", membershipId: `RM-${Math.random().toString(36).slice(2, 8)}`, type, name: "Member", joinedAt: "2026-01-01" }, ACTOR);
  if (!r.ok || !r.member) throw new Error("member failed");
  return r.member;
}

describe("reservation queue", () => {
  beforeEach(() => {
    resetDemoData();
    seq = 0;
  });

  it("assigns sequential queue positions", () => {
    const { book } = makeBookWithCopy();
    const m1 = makeMember();
    const m2 = makeMember();
    const r1 = reserveTitle({ bookId: book.id, memberId: m1.id }, ACTOR);
    const r2 = reserveTitle({ bookId: book.id, memberId: m2.id }, ACTOR);
    expect(r1.ok && r1.reservation!.queuePosition).toBe(1);
    expect(r2.ok && r2.reservation!.queuePosition).toBe(2);
  });

  it("orders teachers ahead of students by priority", () => {
    const { book } = makeBookWithCopy();
    const student = makeMember("student");
    const teacher = makeMember("teacher");
    reserveTitle({ bookId: book.id, memberId: student.id }, ACTOR);
    reserveTitle({ bookId: book.id, memberId: teacher.id }, ACTOR);
    const queue = reservationQueue(getSnapshot(), book.id);
    expect(queue[0].memberId).toBe(teacher.id);
  });

  it("refuses a duplicate active reservation by the same member", () => {
    const { book } = makeBookWithCopy();
    const m = makeMember();
    reserveTitle({ bookId: book.id, memberId: m.id }, ACTOR);
    const again = reserveTitle({ bookId: book.id, memberId: m.id }, ACTOR);
    expect(again.ok).toBe(false);
  });

  it("promotes the next member to ready when a reserved copy is returned (no queue skipping)", () => {
    const { book, copy } = makeBookWithCopy();
    const borrower = makeMember();
    const waiter = makeMember();
    const issued = issueLoan({ memberId: borrower.id, copyId: copy.id }, ACTOR, "2026-08-05");
    if (!issued.ok) throw new Error("issue failed");
    reserveTitle({ bookId: book.id, memberId: waiter.id }, ACTOR);
    returnLoan({ loanId: issued.loan.id }, ACTOR, "2026-08-10");
    const ready = getSnapshot().libraryReservations.find((r) => r.bookId === book.id && r.status === "ready");
    expect(ready?.memberId).toBe(waiter.id);
    expect(ready?.notified).toBe(true);
  });

  it("compacts queue positions after a cancellation", () => {
    const { book } = makeBookWithCopy();
    const m1 = makeMember();
    const m2 = makeMember();
    const m3 = makeMember();
    const r1 = reserveTitle({ bookId: book.id, memberId: m1.id }, ACTOR);
    reserveTitle({ bookId: book.id, memberId: m2.id }, ACTOR);
    reserveTitle({ bookId: book.id, memberId: m3.id }, ACTOR);
    if (r1.ok) cancelReservation(r1.reservation!.id, ACTOR);
    const queue = reservationQueue(getSnapshot(), book.id);
    expect(queue.map((r) => r.queuePosition)).toEqual([1, 2]);
  });
});
