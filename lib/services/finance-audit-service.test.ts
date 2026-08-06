import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { logFinancialAudit } from "./finance-audit-service";

describe("logFinancialAudit", () => {
  beforeEach(() => resetDemoData());

  it("appends a new entry to the front of the log without touching older entries", () => {
    const before = getSnapshot().financialAuditLog;
    logFinancialAudit({ action: "manual-override-used", actorName: "Test Actor", actorRole: "Finance Administrator", summary: "Test entry" });
    const after = getSnapshot().financialAuditLog;
    expect(after.length).toBe(before.length + 1);
    expect(after[0].summary).toBe("Test entry");
    expect(after.slice(1)).toEqual(before);
  });

  it("defaults tenant and branch, and stamps a createdAt timestamp", () => {
    logFinancialAudit({ action: "manual-override-used", actorName: "Test Actor", actorRole: "Finance Administrator", summary: "Defaults check" });
    const entry = getSnapshot().financialAuditLog[0];
    expect(entry.tenantId).toBe("default");
    expect(entry.branch).toBe("main");
    expect(entry.createdAt).toBeTruthy();
    expect(entry.id).toBeTruthy();
  });

  it("preserves an explicit branch when one is given", () => {
    logFinancialAudit({ action: "manual-override-used", actorName: "Test Actor", actorRole: "Finance Administrator", summary: "Explicit branch", branch: "north-campus" });
    expect(getSnapshot().financialAuditLog[0].branch).toBe("north-campus");
  });

  it("carries reason and subjectId through when provided", () => {
    logFinancialAudit({ subjectId: "student-42", action: "manual-override-used", actorName: "Test Actor", actorRole: "Finance Administrator", summary: "With reason", reason: "Because" });
    const entry = getSnapshot().financialAuditLog[0];
    expect(entry.subjectId).toBe("student-42");
    expect(entry.reason).toBe("Because");
  });
});
