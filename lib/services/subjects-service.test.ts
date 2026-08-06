import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData, setState, type Db } from "@/lib/data/store";
import { createAssignment, duplicateSubject, setSubjectStatus, validateAssignment } from "./subjects-service";

/** Removes any existing assignment for this subject+section so a "valid new assignment" test is deterministic, not dependent on what the seed happened to generate. */
function clearAssignment(subjectId: string, sectionId: string) {
  setState((db) => ({ ...db, subjectAssignments: db.subjectAssignments.filter((a) => !(a.subjectId === subjectId && a.sectionId === sectionId)) }));
}

/** The teacher with the most weekly-period headroom left, so adding a small assignment can never trip the overload check. */
function leastLoadedTeacher(db: Db) {
  return [...db.teachers].sort((a, b) => {
    const loadA = db.subjectAssignments.filter((x) => x.primaryTeacherId === a.id).reduce((sum, x) => sum + x.weeklyPeriods, 0);
    const loadB = db.subjectAssignments.filter((x) => x.primaryTeacherId === b.id).reduce((sum, x) => sum + x.weeklyPeriods, 0);
    return loadA - loadB;
  })[0];
}

describe("validateAssignment", () => {
  beforeEach(() => resetDemoData());

  it("rejects a duplicate subject assignment for the same section", () => {
    const db = getSnapshot();
    const existing = db.subjectAssignments[0];
    const result = validateAssignment(
      { subjectId: existing.subjectId, classId: existing.classId, sectionId: existing.sectionId, primaryTeacherId: existing.primaryTeacherId, weeklyPeriods: 3, session: existing.session },
      db,
      db.classes.find((c) => c.id === existing.classId)?.order ?? 1,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("already assigned"))).toBe(true);
  });

  it("rejects a subject outside its grade range", () => {
    const db = getSnapshot();
    const physics = db.subjects.find((s) => s.code === "PHY")!; // grades 9-13
    const section = db.classes[0].sections[0]; // Nursery, order well below 9
    const result = validateAssignment(
      { subjectId: physics.id, classId: db.classes[0].id, sectionId: section.id, primaryTeacherId: db.teachers[0].id, weeklyPeriods: 4, session: "2026-2027" },
      db,
      db.classes[0].order,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("only offered"))).toBe(true);
  });

  it("rejects a teacher whose load would exceed their weekly maximum", () => {
    const db = getSnapshot();
    const teacher = db.teachers[0];
    const overloadedInput = {
      subjectId: db.subjects[0].id,
      classId: db.classes[5].id,
      sectionId: db.classes[5].sections[0].id,
      primaryTeacherId: teacher.id,
      weeklyPeriods: teacher.maxWeeklyPeriods + 10,
      session: "2026-2027",
    };
    const result = validateAssignment(overloadedInput, db, db.classes[5].order);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("maximum weekly periods"))).toBe(true);
  });

  it("rejects a practical subject with no room assigned", () => {
    const db = getSnapshot();
    const chemistry = db.subjects.find((s) => s.code === "CHEM")!;
    const highGradeClass = db.classes.find((c) => c.order >= chemistry.gradeRangeStart)!;
    const result = validateAssignment(
      { subjectId: chemistry.id, classId: highGradeClass.id, sectionId: highGradeClass.sections[0].id, primaryTeacherId: db.teachers[1].id, weeklyPeriods: 3, session: "2026-2027" },
      db,
      highGradeClass.order,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("laboratory"))).toBe(true);
  });

  it("accepts a valid, non-duplicate, in-range assignment", () => {
    const db = getSnapshot();
    const art = db.subjects.find((s) => s.code === "ART")!;
    const targetClass = db.classes.find((c) => c.order >= art.gradeRangeStart && c.order <= art.gradeRangeEnd && c.sections.length > 0)!;
    clearAssignment(art.id, targetClass.sections[0].id);
    const teacher = leastLoadedTeacher(getSnapshot());

    const result = validateAssignment(
      { subjectId: art.id, classId: targetClass.id, sectionId: targetClass.sections[0].id, primaryTeacherId: teacher.id, weeklyPeriods: 2, session: "2026-2027" },
      getSnapshot(),
      targetClass.order,
    );
    expect(result.valid).toBe(true);
  });
});

describe("createAssignment", () => {
  beforeEach(() => resetDemoData());

  it("persists a valid assignment to the store", () => {
    const db = getSnapshot();
    const art = db.subjects.find((s) => s.code === "ART")!;
    const targetClass = db.classes.find((c) => c.order >= art.gradeRangeStart && c.sections.length > 0)!;
    clearAssignment(art.id, targetClass.sections[0].id);
    const teacher = leastLoadedTeacher(getSnapshot());

    const result = createAssignment(
      { subjectId: art.id, classId: targetClass.id, sectionId: targetClass.sections[0].id, primaryTeacherId: teacher.id, weeklyPeriods: 2, session: "2026-2027" },
      targetClass.order,
    );

    expect("assignment" in result).toBe(true);
    if ("assignment" in result) {
      expect(getSnapshot().subjectAssignments.some((a) => a.id === result.assignment.id)).toBe(true);
    }
  });

  it("does not persist an invalid assignment", () => {
    const db = getSnapshot();
    const existing = db.subjectAssignments[0];
    const countBefore = getSnapshot().subjectAssignments.length;

    const result = createAssignment(
      { subjectId: existing.subjectId, classId: existing.classId, sectionId: existing.sectionId, primaryTeacherId: existing.primaryTeacherId, weeklyPeriods: 3, session: existing.session },
      db.classes.find((c) => c.id === existing.classId)?.order ?? 1,
    );

    expect("errors" in result).toBe(true);
    expect(getSnapshot().subjectAssignments.length).toBe(countBefore);
  });
});

describe("duplicateSubject", () => {
  beforeEach(() => resetDemoData());

  it("creates a new subject copying the source's fields", () => {
    const db = getSnapshot();
    const source = db.subjects[0];
    const copy = duplicateSubject(source.id);
    expect(copy).toBeDefined();
    expect(copy?.name).toBe(`Copy of ${source.name}`);
    expect(copy?.type).toBe(source.type);
    expect(copy?.status).toBe("active");
    expect(getSnapshot().subjects.some((s) => s.id === copy?.id)).toBe(true);
    expect(getSnapshot().subjects.find((s) => s.id === source.id)?.name).toBe(source.name);
  });
});

describe("setSubjectStatus", () => {
  beforeEach(() => resetDemoData());

  it("archives and restores exactly the targeted subject", () => {
    const db = getSnapshot();
    const [target, other] = db.subjects;
    setSubjectStatus(target.id, "inactive");
    expect(getSnapshot().subjects.find((s) => s.id === target.id)?.status).toBe("inactive");
    expect(getSnapshot().subjects.find((s) => s.id === other.id)?.status).toBe(other.status);
    setSubjectStatus(target.id, "active");
    expect(getSnapshot().subjects.find((s) => s.id === target.id)?.status).toBe("active");
  });
});
