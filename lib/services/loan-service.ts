import { getSnapshot, setState } from "@/lib/data/store";
import type { Db } from "@/lib/data/store";
import type { Book, BookCopy, CopyCondition, LibraryFine, LibraryLoan, LibraryMember, LibraryRule } from "@/lib/types/library";
import { addDays, daysBetween, matchLoanRule, overdueDays, overdueFine } from "@/lib/selectors/library-loan-rules";
import { zeroMoney } from "@/lib/finance/money";
import { generateId } from "@/lib/utils";
import { logResourceAudit } from "./resource-audit-service";
import { fulfilNextReservation } from "./reservation-service";

type Actor = { name: string; role: string };

export type EligibilityCheck =
  | { ok: true; rule: LibraryRule; dueDate: string; warnings: string[] }
  | { ok: false; error: string };

/** Pure, store-free eligibility evaluation so the issue workspace can preview
 * the outcome (and tests can assert every guard) before anything is mutated.
 * Enforces: active member, available non-reference copy, a matching rule,
 * loan-limit, existing-overdue block, and fine-restriction. */
export function checkLoanEligibility(db: Db, member: LibraryMember | undefined, copy: BookCopy | undefined, book: Book | undefined, asOf: string): EligibilityCheck {
  if (!member) return { ok: false, error: "Member not found." };
  if (!copy) return { ok: false, error: "Copy not found." };
  if (!book) return { ok: false, error: "Book not found." };

  if (member.status !== "active") return { ok: false, error: `Member is ${member.status} and cannot borrow.` };
  if (copy.loanStatus === "issued") return { ok: false, error: "This copy is already issued." };
  if (copy.loanStatus === "withdrawn") return { ok: false, error: "This copy is withdrawn from circulation." };
  if (copy.condition === "lost" || copy.condition === "damaged" || copy.condition === "under-repair") {
    return { ok: false, error: `This copy is ${copy.condition} and cannot be issued.` };
  }

  const rule = matchLoanRule(db.libraryRules, { memberType: member.type, resourceType: book.referenceOnly ? "reference" : "book", categoryId: book.categoryId });
  if (!rule) return { ok: false, error: "No lending policy matches this member and resource. Configure a loan rule first." };
  if (book.referenceOnly && !rule.allowReferenceLoan) return { ok: false, error: "Reference-only titles cannot be issued under this member's policy." };

  const activeLoans = db.libraryLoans.filter((l) => l.memberId === member.id && (l.status === "active" || l.status === "overdue" || l.status === "renewed"));
  if (activeLoans.length >= rule.maxBooks) return { ok: false, error: `Loan limit reached (${rule.maxBooks} book(s)). Return a book before borrowing another.` };

  // Duplicate active loan of the SAME title is not allowed.
  if (activeLoans.some((l) => l.bookId === book.id)) return { ok: false, error: "This member already has a copy of this title on loan." };

  // A copy reserved by ANOTHER member (ready queue) can't be issued to this one.
  const readyReservation = db.libraryReservations.find((r) => r.bookId === book.id && r.status === "ready" && r.memberId !== member.id);
  const ownReservation = db.libraryReservations.find((r) => r.bookId === book.id && r.status === "ready" && r.memberId === member.id);
  if (readyReservation && !ownReservation) return { ok: false, error: "This title is reserved and ready for another member in the queue." };

  const warnings: string[] = [];
  const overdue = db.libraryLoans.filter((l) => l.memberId === member.id && l.status === "overdue");
  if (overdue.length > 0) warnings.push(`Member has ${overdue.length} overdue book(s).`);

  const unpaidFines = db.libraryFines.filter((f) => f.memberId === member.id && (f.status === "pending" || f.status === "generated" || f.status === "partially-paid"));
  const unpaidTotal = unpaidFines.reduce((sum, f) => sum + (f.amount.minorUnits - f.paidAmount.minorUnits - f.waivedAmount.minorUnits), 0);
  if (unpaidTotal > 0) warnings.push(`Member has an outstanding fine balance.`);
  // Hard block: overdue restriction when 3+ overdue OR fine balance over threshold.
  if (overdue.length >= 3) return { ok: false, error: "Borrowing blocked — 3 or more overdue books. Return overdue items first." };

  const dueDate = addDays(asOf, rule.loanDurationDays);
  return { ok: true, rule, dueDate, warnings };
}

export type IssueResult = { ok: true; loan: LibraryLoan; warnings: string[] } | { ok: false; error: string };

export function issueLoan(input: { memberId: string; copyId: string }, actor: Actor, asOf = new Date().toISOString().slice(0, 10)): IssueResult {
  const db = getSnapshot();
  const member = db.libraryMembers.find((m) => m.id === input.memberId);
  const copy = db.bookCopies.find((c) => c.id === input.copyId);
  const book = copy ? db.books.find((b) => b.id === copy.bookId) : undefined;

  const eligibility = checkLoanEligibility(db, member, copy, book, asOf);
  if (!eligibility.ok) return { ok: false, error: eligibility.error };

  const now = new Date().toISOString();
  // Fulfil this member's own ready reservation if present.
  const ownReservation = db.libraryReservations.find((r) => r.bookId === book!.id && r.status === "ready" && r.memberId === member!.id);
  const loan: LibraryLoan = {
    id: generateId("loan"),
    libraryId: copy!.libraryId,
    copyId: copy!.id,
    bookId: book!.id,
    memberId: member!.id,
    issuedAt: now,
    dueDate: eligibility.dueDate,
    renewalCount: 0,
    status: "active",
    issuedBy: actor.name,
    fulfilledReservationId: ownReservation?.id,
    createdAt: now,
    updatedAt: now,
  };

  setState((current) => ({
    ...current,
    libraryLoans: [...current.libraryLoans, loan],
    bookCopies: current.bookCopies.map((c) => (c.id === copy!.id ? { ...c, loanStatus: "issued", currentHolderId: member!.id, updatedAt: now } : c)),
    libraryReservations: ownReservation ? current.libraryReservations.map((r) => (r.id === ownReservation.id ? { ...r, status: "collected", collectedAt: now, updatedAt: now } : r)) : current.libraryReservations,
  }));
  logResourceAudit({ domain: "library", subjectId: loan.id, action: "book-issued", actorName: actor.name, actorRole: actor.role, summary: `"${book!.title}" (${copy!.accessionNumber}) issued to ${member!.name}. Due ${eligibility.dueDate}.` });
  return { ok: true, loan, warnings: eligibility.warnings };
}

export type ReturnResult = { ok: true; loan: LibraryLoan; fine?: LibraryFine } | { ok: false; error: string };

/** Returns a loan: computes overdue days against the governing rule, generates
 * an idempotent overdue fine when warranted, records the inspected condition,
 * releases the copy and triggers reservation fulfilment. */
export function returnLoan(input: { loanId: string; condition?: CopyCondition }, actor: Actor, asOf = new Date().toISOString().slice(0, 10)): ReturnResult {
  const db = getSnapshot();
  const loan = db.libraryLoans.find((l) => l.id === input.loanId);
  if (!loan) return { ok: false, error: "Loan not found." };
  if (loan.status === "returned") return { ok: false, error: "This loan has already been returned." };

  const book = db.books.find((b) => b.id === loan.bookId);
  const member = db.libraryMembers.find((m) => m.id === loan.memberId);
  const rule = matchLoanRule(db.libraryRules, { memberType: member?.type ?? "student", resourceType: book?.referenceOnly ? "reference" : "book", categoryId: book?.categoryId });

  const now = new Date().toISOString();
  const days = rule ? overdueDays(loan.dueDate, asOf, rule.gracePeriodDays) : Math.max(0, daysBetween(loan.dueDate, asOf));

  let fine: LibraryFine | undefined;
  if (rule && days > 0) {
    const amount = overdueFine(rule, days);
    if (amount.minorUnits > 0) {
      const idempotencyKey = `overdue:${loan.id}:${days}`;
      const existing = db.libraryFines.find((f) => f.idempotencyKey === idempotencyKey);
      if (!existing) {
        fine = {
          id: generateId("fine"),
          libraryId: loan.libraryId,
          memberId: loan.memberId,
          loanId: loan.id,
          copyId: loan.copyId,
          type: "overdue",
          amount,
          paidAmount: zeroMoney(amount.currency),
          waivedAmount: zeroMoney(amount.currency),
          status: "pending",
          reason: `${days} day(s) overdue`,
          idempotencyKey,
          createdAt: now,
          updatedAt: now,
        };
      } else {
        fine = existing;
      }
    }
  }

  const condition = input.condition ?? "good";
  setState((current) => ({
    ...current,
    libraryLoans: current.libraryLoans.map((l) => (l.id === loan.id ? { ...l, status: "returned", returnedAt: now, returnedBy: actor.name, returnCondition: condition, fineId: fine?.id ?? l.fineId, updatedAt: now } : l)),
    bookCopies: current.bookCopies.map((c) => (c.id === loan.copyId ? { ...c, loanStatus: "on-shelf", currentHolderId: undefined, condition: condition === "damaged" ? "damaged" : c.condition, updatedAt: now } : c)),
    libraryFines: fine && !db.libraryFines.some((f) => f.id === fine!.id) ? [fine, ...current.libraryFines] : current.libraryFines,
  }));

  logResourceAudit({ domain: "library", subjectId: loan.id, action: "book-returned", actorName: actor.name, actorRole: actor.role, summary: `"${book?.title ?? loan.bookId}" returned by ${member?.name ?? loan.memberId}${days > 0 ? ` (${days} day(s) overdue)` : ""}.` });
  if (fine) logResourceAudit({ domain: "library", subjectId: fine.id, action: "fine-generated", actorName: actor.name, actorRole: actor.role, summary: `Overdue fine generated for ${member?.name ?? loan.memberId}.` });

  // Reservation fulfilment for the freed copy.
  fulfilNextReservation(loan.bookId, actor);

  return { ok: true, loan, fine };
}

export type RenewResult = { ok: true; loan: LibraryLoan } | { ok: false; error: string };

export function renewLoan(loanId: string, actor: Actor, asOf = new Date().toISOString().slice(0, 10)): RenewResult {
  const db = getSnapshot();
  const loan = db.libraryLoans.find((l) => l.id === loanId);
  if (!loan) return { ok: false, error: "Loan not found." };
  if (loan.status === "returned" || loan.status === "lost") return { ok: false, error: "Only active loans can be renewed." };

  const book = db.books.find((b) => b.id === loan.bookId);
  const member = db.libraryMembers.find((m) => m.id === loan.memberId);
  const rule = matchLoanRule(db.libraryRules, { memberType: member?.type ?? "student", resourceType: book?.referenceOnly ? "reference" : "book", categoryId: book?.categoryId });
  if (!rule) return { ok: false, error: "No lending policy found for this loan." };
  if (loan.renewalCount >= rule.renewalCount) return { ok: false, error: `Renewal limit reached (${rule.renewalCount}).` };

  // A copy with a waiting reservation queue can't be renewed.
  const hasQueue = db.libraryReservations.some((r) => r.bookId === loan.bookId && (r.status === "waiting" || r.status === "ready"));
  if (hasQueue) return { ok: false, error: "Cannot renew — another member is waiting for this title." };

  const now = new Date().toISOString();
  const newDue = addDays(asOf, rule.renewalDurationDays);
  setState((current) => ({ ...current, libraryLoans: current.libraryLoans.map((l) => (l.id === loanId ? { ...l, dueDate: newDue, renewalCount: l.renewalCount + 1, status: "active", updatedAt: now } : l)) }));
  logResourceAudit({ domain: "library", subjectId: loanId, action: "loan-renewed", actorName: actor.name, actorRole: actor.role, summary: `Loan for "${book?.title ?? loan.bookId}" renewed to ${newDue}.` });
  return { ok: true, loan: { ...loan, dueDate: newDue, renewalCount: loan.renewalCount + 1 } };
}

/** Marks an outstanding loan as lost and raises a replacement charge. */
export function markLoanLost(loanId: string, actor: Actor, reason?: string): { ok: true; fine: LibraryFine } | { ok: false; error: string } {
  const db = getSnapshot();
  const loan = db.libraryLoans.find((l) => l.id === loanId);
  if (!loan) return { ok: false, error: "Loan not found." };
  const copy = db.bookCopies.find((c) => c.id === loan.copyId);
  if (!copy) return { ok: false, error: "Copy not found." };
  const member = db.libraryMembers.find((m) => m.id === loan.memberId);

  const now = new Date().toISOString();
  const idempotencyKey = `lost:${loan.id}`;
  const existing = db.libraryFines.find((f) => f.idempotencyKey === idempotencyKey);
  const fine: LibraryFine = existing ?? {
    id: generateId("fine"),
    libraryId: loan.libraryId,
    memberId: loan.memberId,
    loanId: loan.id,
    copyId: loan.copyId,
    type: "lost",
    amount: copy.replacementCost,
    paidAmount: zeroMoney(copy.replacementCost.currency),
    waivedAmount: zeroMoney(copy.replacementCost.currency),
    status: "pending",
    reason: reason ?? "Copy reported lost",
    idempotencyKey,
    createdAt: now,
    updatedAt: now,
  };

  setState((current) => ({
    ...current,
    libraryLoans: current.libraryLoans.map((l) => (l.id === loanId ? { ...l, status: "lost", fineId: fine.id, updatedAt: now } : l)),
    bookCopies: current.bookCopies.map((c) => (c.id === loan.copyId ? { ...c, condition: "lost", loanStatus: "lost", updatedAt: now } : c)),
    libraryFines: existing ? current.libraryFines : [fine, ...current.libraryFines],
  }));
  logResourceAudit({ domain: "library", subjectId: loan.copyId, action: "copy-marked-lost", actorName: actor.name, actorRole: actor.role, summary: `Copy ${copy.accessionNumber} marked lost by ${member?.name ?? loan.memberId}.`, reason });
  return { ok: true, fine };
}
