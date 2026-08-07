import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { createStop, flagUnsafeStop, setAlternateStop, setStopStatus, updateStop } from "./stop-service";

const ACTOR = { name: "Transport Administrator", role: "Transport Administrator" };

function draft(overrides: Partial<Parameters<typeof createStop>[0]> = {}) {
  return {
    name: "Test Stop",
    code: "STP-TEST-01",
    address: "Test Address",
    latitude: 12.9,
    longitude: 77.6,
    geofenceRadiusMeters: 150,
    branch: "main",
    status: "active" as const,
    ...overrides,
  };
}

describe("createStop / updateStop / setStopStatus", () => {
  beforeEach(() => resetDemoData());

  it("creates an active stop", () => {
    const result = createStop(draft(), ACTOR);
    expect(result.ok).toBe(true);
    if (!result.ok || !result.stop) return;
    expect(getSnapshot().transportStops.some((s) => s.id === result.stop!.id)).toBe(true);
  });

  it("refuses a duplicate stop code", () => {
    const db = getSnapshot();
    const existing = db.transportStops[0];
    const result = createStop(draft({ code: existing.code }), ACTOR);
    expect(result.ok).toBe(false);
  });

  it("updates a stop's fields", () => {
    const created = createStop(draft(), ACTOR);
    if (!created.ok || !created.stop) return;
    const result = updateStop(created.stop.id, { name: "Renamed Stop" }, ACTOR);
    expect(result.ok).toBe(true);
    expect(getSnapshot().transportStops.find((s) => s.id === created.stop!.id)?.name).toBe("Renamed Stop");
  });

  it("changes a stop's status", () => {
    const created = createStop(draft(), ACTOR);
    if (!created.ok || !created.stop) return;
    expect(setStopStatus(created.stop.id, "temporary", ACTOR).ok).toBe(true);
    expect(getSnapshot().transportStops.find((s) => s.id === created.stop!.id)?.status).toBe("temporary");
  });
});

describe("flagUnsafeStop / setAlternateStop", () => {
  beforeEach(() => resetDemoData());

  it("flags a stop unsafe with safety notes", () => {
    const created = createStop(draft(), ACTOR);
    if (!created.ok || !created.stop) return;
    const result = flagUnsafeStop(created.stop.id, "Road construction blocking access", ACTOR);
    expect(result.ok).toBe(true);
    const updated = getSnapshot().transportStops.find((s) => s.id === created.stop!.id);
    expect(updated?.status).toBe("unsafe");
    expect(updated?.safetyNotes).toBe("Road construction blocking access");
  });

  it("sets an alternate stop", () => {
    const created = createStop(draft(), ACTOR);
    const alternate = createStop(draft({ code: "STP-TEST-02", name: "Alternate Stop" }), ACTOR);
    if (!created.ok || !created.stop || !alternate.ok || !alternate.stop) return;
    const result = setAlternateStop(created.stop.id, alternate.stop.id, ACTOR);
    expect(result.ok).toBe(true);
    expect(getSnapshot().transportStops.find((s) => s.id === created.stop!.id)?.alternateStopId).toBe(alternate.stop.id);
  });

  it("refuses to set a non-existent alternate stop", () => {
    const created = createStop(draft(), ACTOR);
    if (!created.ok || !created.stop) return;
    expect(setAlternateStop(created.stop.id, "no-such-stop", ACTOR).ok).toBe(false);
  });
});
