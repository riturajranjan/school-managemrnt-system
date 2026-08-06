import { describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { classAttendanceTodayPercent, classCurriculumCompletionPercent, classRoomNames, classTeacherNames } from "./class-insights";

describe("classTeacherNames", () => {
  it("returns unique class teacher names across sections", () => {
    resetDemoData();
    const db = getSnapshot();
    const schoolClass = db.classes.find((c) => c.sections.some((s) => s.classTeacherId));
    if (!schoolClass) return;
    const names = classTeacherNames(schoolClass);
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("classRoomNames", () => {
  it("returns unique room names for sections that have one assigned", () => {
    resetDemoData();
    const db = getSnapshot();
    const schoolClass = db.classes.find((c) => c.sections.some((s) => s.roomId));
    if (!schoolClass) return;
    const names = classRoomNames(schoolClass);
    expect(names.length).toBeGreaterThan(0);
  });
});

describe("classAttendanceTodayPercent", () => {
  it("returns null for a class with no sections", () => {
    resetDemoData();
    const db = getSnapshot();
    const empty = { id: "x", name: "Empty", order: 99, status: "active" as const, sections: [] };
    expect(classAttendanceTodayPercent(db, empty)).toBeNull();
  });

  it("returns a percentage between 0 and 100 for a class with sections", () => {
    resetDemoData();
    const db = getSnapshot();
    const schoolClass = db.classes.find((c) => c.sections.length > 0);
    if (!schoolClass) return;
    const percent = classAttendanceTodayPercent(db, schoolClass);
    expect(percent).toBeGreaterThanOrEqual(0);
    expect(percent).toBeLessThanOrEqual(100);
  });
});

describe("classCurriculumCompletionPercent", () => {
  it("returns 0 for a class with no curriculum units", () => {
    resetDemoData();
    const db = getSnapshot();
    const classWithoutUnits = db.classes.find((c) => !db.curriculumUnits.some((u) => u.classId === c.id));
    if (!classWithoutUnits) return;
    expect(classCurriculumCompletionPercent(db, classWithoutUnits.id)).toBe(0);
  });
});
