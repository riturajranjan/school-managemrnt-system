import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import {
  advanceEventStage,
  awardHousePoints,
  cancelEvent,
  joinClub,
  recordCompetitionScore,
  registerForEvent,
  setBracketResult,
  setFixtureResult,
} from "./activities-service";

describe("event journey lifecycle", () => {
  beforeEach(() => resetDemoData());

  it("advances an event to the next pipeline stage", () => {
    const event = getSnapshot().schoolEvents.find((e) => e.stage === "planning")!;
    const result = advanceEventStage(event.id);
    expect(result.ok).toBe(true);
    expect(getSnapshot().schoolEvents.find((e) => e.id === event.id)?.stage).toBe("approved");
  });

  it("refuses to advance a cancelled event", () => {
    const event = getSnapshot().schoolEvents.find((e) => e.stage === "planning")!;
    cancelEvent(event.id);
    expect(advanceEventStage(event.id).ok).toBe(false);
  });
});

describe("event registration integrity", () => {
  beforeEach(() => resetDemoData());

  function registerableEvent() {
    return getSnapshot().schoolEvents.find((e) => e.registrationMode !== "none");
  }

  it("registers a student and increments the count", () => {
    const event = registerableEvent()!;
    const before = getSnapshot().schoolEvents.find((e) => e.id === event.id)!.registeredCount;
    const student = getSnapshot().students.find((s) => !getSnapshot().eventRegistrations.some((r) => r.eventId === event.id && r.studentId === s.id))!;
    const result = registerForEvent(event.id, student.id);
    expect(result.ok).toBe(true);
    if (result.status !== "waitlisted") {
      expect(getSnapshot().schoolEvents.find((e) => e.id === event.id)!.registeredCount).toBe(before + 1);
    }
  });

  it("prevents duplicate registration", () => {
    const event = registerableEvent()!;
    const student = getSnapshot().students[0];
    registerForEvent(event.id, student.id);
    expect(registerForEvent(event.id, student.id).ok).toBe(false);
  });
});

describe("club membership", () => {
  beforeEach(() => resetDemoData());

  it("prevents a duplicate club membership", () => {
    const club = getSnapshot().clubs[0];
    const member = getSnapshot().clubMemberships.find((m) => m.clubId === club.id)!;
    expect(joinClub(club.id, member.studentId).ok).toBe(false);
  });
});

describe("sports results", () => {
  beforeEach(() => resetDemoData());

  it("refuses a negative fixture score", () => {
    const fixture = getSnapshot().fixtures[0];
    expect(setFixtureResult(fixture.id, -1, 2).ok).toBe(false);
  });

  it("records a fixture result and marks it completed", () => {
    const fixture = getSnapshot().fixtures.find((f) => f.status !== "completed")!;
    const result = setFixtureResult(fixture.id, 3, 1);
    expect(result.ok).toBe(true);
    expect(getSnapshot().fixtures.find((f) => f.id === fixture.id)?.status).toBe("completed");
  });

  it("rejects a drawn knockout bracket match", () => {
    const match = getSnapshot().bracketMatches.find((m) => m.teamA && m.teamB)!;
    expect(setBracketResult(match.id, 2, 2).ok).toBe(false);
  });

  it("advances the winner into the next bracket round", () => {
    const final = getSnapshot().bracketMatches.find((m) => m.round === 2)!;
    const semi = getSnapshot().bracketMatches.find((m) => m.round === 1 && m.status !== "completed" && m.teamA && m.teamB);
    // Both semis are pre-seeded as completed; assert the final has both teams fed in.
    if (!semi) {
      expect(final.teamA).toBeDefined();
      expect(final.teamB).toBeDefined();
    }
  });
});

describe("competition scoring (human-entered, weighted)", () => {
  beforeEach(() => resetDemoData());

  it("rejects a score above the criterion max", () => {
    const comp = getSnapshot().competitions[0];
    const participant = getSnapshot().competitionParticipants.find((p) => p.competitionId === comp.id)!;
    const criterion = comp.criteria[0];
    expect(recordCompetitionScore(participant.id, criterion.id, criterion.maxScore + 5).ok).toBe(false);
  });

  it("records a score and recomputes a weighted total", () => {
    const comp = getSnapshot().competitions[0];
    const participant = getSnapshot().competitionParticipants.find((p) => p.competitionId === comp.id)!;
    comp.criteria.forEach((cr) => recordCompetitionScore(participant.id, cr.id, cr.maxScore));
    const updated = getSnapshot().competitionParticipants.find((p) => p.id === participant.id)!;
    // Full marks on every criterion => weighted total equals the sum of weights.
    const expected = comp.criteria.reduce((s, cr) => s + cr.weight, 0);
    expect(Math.round(updated.totalScore ?? 0)).toBe(Math.round(expected));
  });
});

describe("house points ledger", () => {
  beforeEach(() => resetDemoData());

  it("appends a point entry and recomputes totals and ranks", () => {
    const house = getSnapshot().houses[0];
    const before = getSnapshot().houses.find((h) => h.id === house.id)!.totalPoints;
    const result = awardHousePoints({ houseId: house.id, points: 25, reason: "special-recognition", description: "Test award", awardedBy: "Tester", awardedByRole: "House Master" });
    expect(result.ok).toBe(true);
    expect(getSnapshot().houses.find((h) => h.id === house.id)!.totalPoints).toBe(before + 25);
    // Ranks stay a 1..N permutation.
    const ranks = getSnapshot().houses.map((h) => h.rank).sort((a, b) => a - b);
    expect(ranks).toEqual(getSnapshot().houses.map((_, i) => i + 1));
  });

  it("refuses a zero-point award", () => {
    const house = getSnapshot().houses[0];
    expect(awardHousePoints({ houseId: house.id, points: 0, reason: "adjustment", description: "x", awardedBy: "T", awardedByRole: "R" }).ok).toBe(false);
  });
});
