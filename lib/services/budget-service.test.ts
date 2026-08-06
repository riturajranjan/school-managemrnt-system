import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { moneyFromMajor } from "@/lib/finance/money";
import { approveBudget, createBudget, reviseBudget } from "./budget-service";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };

function draftLines() {
  return [{ category: "technology" as const, plannedAmount: moneyFromMajor(100000, "INR"), alertThresholdPercent: 85 }];
}

describe("budget-service", () => {
  beforeEach(() => resetDemoData());

  it("creates a draft budget with zeroed committed/actual amounts", () => {
    const budget = createBudget({ name: "Test Budget", session: "2026-2027", financialYear: "2026-2027", branch: "main", lines: draftLines() }, ACTOR);
    expect(budget.status).toBe("draft");
    expect(budget.lines[0].committedAmount.minorUnits).toBe(0);
    expect(getSnapshot().budgets.some((b) => b.id === budget.id)).toBe(true);
  });

  it("approves a draft budget", () => {
    const budget = createBudget({ name: "Approve Me", session: "2026-2027", financialYear: "2026-2027", branch: "main", lines: draftLines() }, ACTOR);
    const result = approveBudget(budget.id, ACTOR);
    expect(result.ok).toBe(true);
    expect(getSnapshot().budgets.find((b) => b.id === budget.id)?.status).toBe("approved");
  });

  it("refuses to approve an already-approved budget", () => {
    const budget = createBudget({ name: "Double Approve", session: "2026-2027", financialYear: "2026-2027", branch: "main", lines: draftLines() }, ACTOR);
    approveBudget(budget.id, ACTOR);
    expect(approveBudget(budget.id, ACTOR).ok).toBe(false);
  });

  it("revises a budget into a new record, marking the original revised", () => {
    const budget = createBudget({ name: "To Revise", session: "2026-2027", financialYear: "2026-2027", branch: "main", lines: draftLines() }, ACTOR);
    approveBudget(budget.id, ACTOR);
    const result = reviseBudget(budget.id, [{ category: "technology", plannedAmount: moneyFromMajor(150000, "INR"), alertThresholdPercent: 90 }], ACTOR);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.budget.revisionOf).toBe(budget.id);
    expect(result.budget.lines[0].plannedAmount.minorUnits).toBe(moneyFromMajor(150000, "INR").minorUnits);
    expect(getSnapshot().budgets.find((b) => b.id === budget.id)?.status).toBe("revised");
  });
});
