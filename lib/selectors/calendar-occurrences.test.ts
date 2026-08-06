import { describe, expect, it } from "vitest";
import { expandOccurrences } from "./calendar-occurrences";
import type { AcademicEvent } from "@/lib/types/academics";

function baseEvent(partial: Partial<AcademicEvent>): AcademicEvent {
  return { id: "ev-1", title: "Test event", type: "event", startDate: "2026-01-05T00:00:00.000Z", allDay: true, audience: ["all"], createdBy: "Admin", ...partial };
}

describe("expandOccurrences", () => {
  it("returns a single occurrence for a non-recurring event within range", () => {
    const event = baseEvent({ recurring: "none" });
    const occurrences = expandOccurrences([event], "2026-01-01", "2026-01-31");
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].date).toBe("2026-01-05");
  });

  it("excludes a non-recurring event outside the range", () => {
    const event = baseEvent({ startDate: "2026-03-05T00:00:00.000Z" });
    const occurrences = expandOccurrences([event], "2026-01-01", "2026-01-31");
    expect(occurrences).toHaveLength(0);
  });

  it("expands a weekly recurring event across the range", () => {
    const event = baseEvent({ recurring: "weekly", startDate: "2026-01-05T00:00:00.000Z" });
    const occurrences = expandOccurrences([event], "2026-01-01", "2026-01-31");
    expect(occurrences.map((o) => o.date)).toEqual(["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26"]);
  });

  it("expands a yearly recurring event only on its anniversary", () => {
    const event = baseEvent({ recurring: "yearly", startDate: "2025-08-15T00:00:00.000Z" });
    const occurrences = expandOccurrences([event], "2025-01-01", "2027-12-31");
    expect(occurrences.map((o) => o.date)).toEqual(["2025-08-15", "2026-08-15", "2027-08-15"]);
  });

  it("does not produce a yearly occurrence before the event's own start date", () => {
    const event = baseEvent({ recurring: "yearly", startDate: "2026-08-15T00:00:00.000Z" });
    const occurrences = expandOccurrences([event], "2025-01-01", "2026-12-31");
    expect(occurrences.map((o) => o.date)).toEqual(["2026-08-15"]);
  });
});
