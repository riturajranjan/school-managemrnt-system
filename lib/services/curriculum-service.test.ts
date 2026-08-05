import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { curriculumCompletionPercent } from "@/lib/selectors/academics-insights";
import { updateChapterStatus, updateUnitStatus } from "./curriculum-service";

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
