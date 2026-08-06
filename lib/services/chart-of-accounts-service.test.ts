import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { createChartOfAccount, setChartOfAccountStatus } from "./chart-of-accounts-service";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };

describe("chart-of-accounts-service", () => {
  beforeEach(() => resetDemoData());

  it("creates an active account with a zero opening balance", () => {
    const account = createChartOfAccount({ code: "5080", name: "Insurance Expense", type: "expense" }, ACTOR);
    expect(account.status).toBe("active");
    expect(account.openingBalance.minorUnits).toBe(0);
    expect(getSnapshot().chartOfAccounts.some((a) => a.id === account.id)).toBe(true);
  });

  it("marks an account inactive", () => {
    const account = createChartOfAccount({ code: "5090", name: "Test Account", type: "expense" }, ACTOR);
    const result = setChartOfAccountStatus(account.id, "inactive", ACTOR);
    expect(result.ok).toBe(true);
    expect(getSnapshot().chartOfAccounts.find((a) => a.id === account.id)?.status).toBe("inactive");
  });

  it("refuses to update a non-existent account", () => {
    expect(setChartOfAccountStatus("no-such-account", "inactive", ACTOR).ok).toBe(false);
  });
});
