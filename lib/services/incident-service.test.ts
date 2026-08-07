import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { reportIncident, updateIncident, updateIncidentStatus } from "./incident-service";

const ACTOR = { name: "Ramesh Kumar", role: "Driver" };

function draft(overrides: Partial<Parameters<typeof reportIncident>[0]> = {}) {
  return {
    type: "breakdown" as const,
    occurredAt: new Date().toISOString(),
    reportedBy: ACTOR.name,
    severity: "medium" as const,
    description: "Test incident",
    parentCommunicated: false,
    authorityCommunicated: false,
    ...overrides,
  };
}

describe("reportIncident", () => {
  beforeEach(() => resetDemoData());

  it("creates an open incident with a sequential incident number", () => {
    const incident = reportIncident(draft(), ACTOR);
    expect(incident.status).toBe("open");
    expect(incident.incidentNumber).toMatch(/^INC-\d{4}-\d{4}$/);
    expect(getSnapshot().transportIncidents.some((i) => i.id === incident.id)).toBe(true);
  });

  it("continues the sequence from existing incidents in the same year", () => {
    const db = getSnapshot();
    const existingCount = db.transportIncidents.length;
    const incident = reportIncident(draft(), ACTOR);
    const number = Number(incident.incidentNumber.match(/(\d+)$/)?.[1]);
    expect(number).toBe(existingCount + 1);
  });
});

describe("updateIncidentStatus / updateIncident", () => {
  beforeEach(() => resetDemoData());

  it("updates an incident's status with a resolution note", () => {
    const incident = reportIncident(draft(), ACTOR);
    const result = updateIncidentStatus(incident.id, "resolved", ACTOR, "Vehicle repaired and returned to service.");
    expect(result.ok).toBe(true);
    const after = getSnapshot().transportIncidents.find((i) => i.id === incident.id);
    expect(after?.status).toBe("resolved");
    expect(after?.resolution).toBe("Vehicle repaired and returned to service.");
  });

  it("updates incident fields", () => {
    const incident = reportIncident(draft(), ACTOR);
    const result = updateIncident(incident.id, { severity: "critical" }, ACTOR);
    expect(result.ok).toBe(true);
    expect(getSnapshot().transportIncidents.find((i) => i.id === incident.id)?.severity).toBe("critical");
  });

  it("refuses to update a non-existent incident", () => {
    expect(updateIncidentStatus("no-such-incident", "closed", ACTOR).ok).toBe(false);
  });
});
