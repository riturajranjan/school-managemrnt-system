import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { logTransportAudit } from "./transport-audit-service";

describe("logTransportAudit", () => {
  beforeEach(() => resetDemoData());

  it("appends a new entry to the front of the log", () => {
    const before = getSnapshot().transportAuditLog;
    logTransportAudit({ action: "manual-override-used", actorName: "Test Actor", actorRole: "Transport Administrator", summary: "Test entry" });
    const after = getSnapshot().transportAuditLog;
    expect(after.length).toBe(before.length + 1);
    expect(after[0].summary).toBe("Test entry");
  });

  it("defaults tenant and branch, and stamps a createdAt timestamp", () => {
    logTransportAudit({ action: "manual-override-used", actorName: "Test Actor", actorRole: "Transport Administrator", summary: "Defaults check" });
    const entry = getSnapshot().transportAuditLog[0];
    expect(entry.tenantId).toBe("default");
    expect(entry.branch).toBe("main");
    expect(entry.createdAt).toBeTruthy();
    expect(entry.id).toBeTruthy();
  });

  it("carries tripId and reason through when provided", () => {
    logTransportAudit({ action: "trip-started", actorName: "Test Actor", actorRole: "Dispatcher", summary: "Trip started", tripId: "trip-1", reason: "Scheduled start" });
    const entry = getSnapshot().transportAuditLog[0];
    expect(entry.tripId).toBe("trip-1");
    expect(entry.reason).toBe("Scheduled start");
  });
});
