import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { collectFine, createManualFine, fineOutstanding, refundFine, waiveFine } from "./library-fine-service";
import { createMember } from "./library-member-service";
import { moneyFromMajor, toMajorUnits } from "@/lib/finance/money";

const ACTOR = { name: "Librarian", role: "Librarian" };

function makeMember() {
  const r = createMember({ libraryId: "lib-main", membershipId: `FM-${Math.random().toString(36).slice(2, 8)}`, type: "student", name: "Member", joinedAt: "2026-01-01" }, ACTOR);
  if (!r.ok || !r.member) throw new Error("member failed");
  return r.member;
}

function makeFine(major = 100) {
  const member = makeMember();
  const r = createManualFine({ libraryId: "lib-main", memberId: member.id, type: "manual", amount: moneyFromMajor(major, "INR"), reason: "test" }, ACTOR);
  if (!r.ok || !r.fine) throw new Error("fine failed");
  return r.fine;
}

describe("collectFine", () => {
  beforeEach(() => resetDemoData());

  it("marks a fully-paid fine as paid", () => {
    const fine = makeFine(100);
    const result = collectFine(fine.id, moneyFromMajor(100, "INR"), ACTOR);
    expect(result.ok).toBe(true);
    expect(getSnapshot().libraryFines.find((f) => f.id === fine.id)?.status).toBe("paid");
  });

  it("marks a partial payment as partially-paid", () => {
    const fine = makeFine(100);
    collectFine(fine.id, moneyFromMajor(40, "INR"), ACTOR);
    const updated = getSnapshot().libraryFines.find((f) => f.id === fine.id)!;
    expect(updated.status).toBe("partially-paid");
    expect(toMajorUnits(fineOutstanding(updated))).toBe(60);
  });

  it("refuses a payment exceeding the outstanding balance", () => {
    const fine = makeFine(100);
    expect(collectFine(fine.id, moneyFromMajor(150, "INR"), ACTOR).ok).toBe(false);
  });
});

describe("waiveFine", () => {
  beforeEach(() => resetDemoData());

  it("waives the full balance with a reason", () => {
    const fine = makeFine(100);
    const result = waiveFine(fine.id, ACTOR, { reason: "Goodwill" });
    expect(result.ok).toBe(true);
    expect(getSnapshot().libraryFines.find((f) => f.id === fine.id)?.status).toBe("waived");
  });

  it("requires a reason", () => {
    const fine = makeFine(100);
    expect(waiveFine(fine.id, ACTOR, { reason: "" }).ok).toBe(false);
  });

  it("supports a partial waiver leaving a balance", () => {
    const fine = makeFine(100);
    waiveFine(fine.id, ACTOR, { amount: moneyFromMajor(30, "INR"), reason: "Partial" });
    const updated = getSnapshot().libraryFines.find((f) => f.id === fine.id)!;
    expect(toMajorUnits(fineOutstanding(updated))).toBe(70);
  });
});

describe("refundFine", () => {
  beforeEach(() => resetDemoData());

  it("refuses to refund a fine with no payment", () => {
    const fine = makeFine(100);
    expect(refundFine(fine.id, ACTOR).ok).toBe(false);
  });

  it("refunds a paid fine", () => {
    const fine = makeFine(100);
    collectFine(fine.id, moneyFromMajor(100, "INR"), ACTOR);
    const result = refundFine(fine.id, ACTOR, "Overcharged");
    expect(result.ok).toBe(true);
    expect(getSnapshot().libraryFines.find((f) => f.id === fine.id)?.status).toBe("refunded");
  });
});
