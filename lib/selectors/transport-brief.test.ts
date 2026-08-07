import { describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { dailyTransportBrief, transportExceptions } from "./transport-brief";

describe("transportExceptions", () => {
  it("returns exceptions sorted with high severity first", () => {
    resetDemoData();
    const db = getSnapshot();
    const exceptions = transportExceptions(db);
    const severityRank = { high: 0, medium: 1, low: 2 };
    for (let i = 1; i < exceptions.length; i++) {
      expect(severityRank[exceptions[i - 1].severity]).toBeLessThanOrEqual(severityRank[exceptions[i].severity]);
    }
  });

  it("every exception points somewhere real under /transport", () => {
    resetDemoData();
    const db = getSnapshot();
    const exceptions = transportExceptions(db);
    for (const exception of exceptions) {
      expect(exception.href.startsWith("/transport")).toBe(true);
    }
  });
});

describe("dailyTransportBrief", () => {
  it("keeps trip status counts consistent with the day's total", () => {
    resetDemoData();
    const db = getSnapshot();
    const brief = dailyTransportBrief(db);
    expect(brief.tripsCompleted + brief.tripsInProgress + brief.tripsDelayed + brief.tripsNotStarted).toBeLessThanOrEqual(brief.tripsToday);
    expect(brief.studentsInTransit).toBeGreaterThanOrEqual(0);
  });
});
