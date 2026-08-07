import { describe, expect, it } from "vitest";
import { addDays, daysBetween, matchLoanRule, overdueDays, overdueFine } from "./library-loan-rules";
import { moneyFromMajor, toMajorUnits } from "@/lib/finance/money";
import type { LibraryRule } from "@/lib/types/library";

function rule(overrides: Partial<LibraryRule>): LibraryRule {
  return {
    id: "r",
    libraryId: "lib-main",
    name: "test",
    maxBooks: 3,
    loanDurationDays: 14,
    renewalCount: 1,
    renewalDurationDays: 7,
    gracePeriodDays: 2,
    finePerDay: moneyFromMajor(2, "INR"),
    maxFine: moneyFromMajor(200, "INR"),
    reservationAllowance: 2,
    allowReferenceLoan: false,
    allowDigitalDownload: true,
    priority: 0,
    createdAt: "2026-08-01",
    updatedAt: "2026-08-01",
    ...overrides,
  };
}

describe("date helpers", () => {
  it("counts whole days between ISO dates", () => {
    expect(daysBetween("2026-08-01", "2026-08-15")).toBe(14);
    expect(daysBetween("2026-08-15", "2026-08-01")).toBe(-14);
  });
  it("adds days across month boundaries", () => {
    expect(addDays("2026-08-25", 10)).toBe("2026-09-04");
  });
});

describe("matchLoanRule", () => {
  const fallback = rule({ id: "fallback", priority: 0 });
  const teacher = rule({ id: "teacher", memberType: "teacher", priority: 5 });
  const textbook = rule({ id: "textbook", resourceType: "textbook", priority: 3 });

  it("prefers a more specific rule over the fallback", () => {
    const match = matchLoanRule([fallback, teacher], { memberType: "teacher", resourceType: "book" });
    expect(match?.id).toBe("teacher");
  });

  it("falls back to the tenant-wide rule when nothing specific matches", () => {
    const match = matchLoanRule([fallback, teacher], { memberType: "student", resourceType: "book" });
    expect(match?.id).toBe("fallback");
  });

  it("breaks specificity ties on priority", () => {
    const match = matchLoanRule([teacher, textbook], { memberType: "teacher", resourceType: "textbook" });
    // Both have specificity 1; teacher has higher priority.
    expect(match?.id).toBe("teacher");
  });

  it("returns null when not even a fallback exists", () => {
    expect(matchLoanRule([teacher], { memberType: "student", resourceType: "book" })).toBeNull();
  });
});

describe("overdueDays", () => {
  it("returns 0 while inside the grace window", () => {
    expect(overdueDays("2026-08-10", "2026-08-12", 2)).toBe(0);
  });
  it("counts days beyond the grace window", () => {
    expect(overdueDays("2026-08-10", "2026-08-15", 2)).toBe(3);
  });
  it("never returns a negative for an on-time return", () => {
    expect(overdueDays("2026-08-20", "2026-08-15", 2)).toBe(0);
  });
});

describe("overdueFine", () => {
  it("is zero for a non-overdue loan", () => {
    expect(overdueFine(rule({}), 0).minorUnits).toBe(0);
  });
  it("charges per-day and stays decimal-safe", () => {
    const fine = overdueFine(rule({ finePerDay: moneyFromMajor(2.5, "INR") }), 4);
    expect(toMajorUnits(fine)).toBe(10);
  });
  it("caps at the rule's maximum fine", () => {
    const fine = overdueFine(rule({ finePerDay: moneyFromMajor(2, "INR"), maxFine: moneyFromMajor(200, "INR") }), 500);
    expect(toMajorUnits(fine)).toBe(200);
  });
});
