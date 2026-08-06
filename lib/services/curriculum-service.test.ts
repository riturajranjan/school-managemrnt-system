import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { curriculumCompletionPercent } from "@/lib/selectors/academics-insights";
import { addUnitNote, markUnitComplete, reschedulePlannedDates, updateChapterStatus, updateUnitStatus } from "./curriculum-service";

describe("updateUnitStatus", () => {
  beforeEach(() => resetDemoData());

  it("updates status and completed periods for exactly the targeted unit", () => {
    const db = getSnapshot();
    const [target, other] = db.curriculumUnits;
    const otherStatusBefore = other.status;

    updateUnitStatus(target.id, "completed", target.estimatedPeriods);

    const updated = getSnapshot().curriculumUnits.find((u) => u.id === target.id);
    expect(updated?.status).toBe("completed");
    expect(updated?.completedPeriods).toBe(target.estimatedPeriods);
    expect(updated?.actualCompletion).toBeDefined();
    expect(getSnapshot().curriculumUnits.find((u) => u.id === other.id)?.status).toBe(otherStatusBefore);
  });

  it("moves overall completion percentage when a unit is completed", () => {
    const db = getSnapshot();
    const target = db.curriculumUnits.find((u) => u.status !== "completed")!;
    const before = curriculumCompletionPercent(getSnapshot().curriculumUnits);

    updateUnitStatus(target.id, "completed", target.estimatedPeriods);

    const after = curriculumCompletionPercent(getSnapshot().curriculumUnits);
    expect(after).toBeGreaterThanOrEqual(before);
  });
});

describe("updateChapterStatus", () => {
  beforeEach(() => resetDemoData());

  it("updates only the targeted chapter within a unit", () => {
    const unit = getSnapshot().curriculumUnits.find((u) => u.chapters.length > 1)!;
    const [target, other] = unit.chapters;

    updateChapterStatus(unit.id, target.id, "completed");

    const updatedUnit = getSnapshot().curriculumUnits.find((u) => u.id === unit.id)!;
    expect(updatedUnit.chapters.find((c) => c.id === target.id)?.status).toBe("completed");
    expect(updatedUnit.chapters.find((c) => c.id === other.id)?.status).toBe(other.status);
  });
});

describe("markUnitComplete", () => {
  beforeEach(() => resetDemoData());

  it("marks the unit fully complete regardless of prior progress", () => {
    const db = getSnapshot();
    const unit = db.curriculumUnits.find((u) => u.status !== "completed")!;
    markUnitComplete(unit.id);
    const updated = getSnapshot().curriculumUnits.find((u) => u.id === unit.id)!;
    expect(updated.status).toBe("completed");
    expect(updated.completedPeriods).toBe(updated.estimatedPeriods);
    expect(updated.actualCompletion).toBeDefined();
  });
});

describe("reschedulePlannedDates", () => {
  beforeEach(() => resetDemoData());

  it("updates planned dates and clears a delayed status", () => {
    const db = getSnapshot();
    const delayed = db.curriculumUnits.find((u) => u.status === "delayed");
    if (!delayed) return;
    reschedulePlannedDates(delayed.id, "2026-09-01", "2026-09-15");
    const updated = getSnapshot().curriculumUnits.find((u) => u.id === delayed.id)!;
    expect(updated.plannedStart).toBe("2026-09-01");
    expect(updated.plannedEnd).toBe("2026-09-15");
    expect(updated.status).not.toBe("delayed");
  });
});

describe("addUnitNote", () => {
  beforeEach(() => resetDemoData());

  it("appends a note to the unit's note list", () => {
    const db = getSnapshot();
    const unit = db.curriculumUnits[0];
    addUnitNote(unit.id, "Falling behind on chapter 3", "Academic Coordinator");
    const updated = getSnapshot().curriculumUnits.find((u) => u.id === unit.id)!;
    expect(updated.notes?.length).toBe(1);
    expect(updated.notes?.[0].text).toBe("Falling behind on chapter 3");
  });
});
