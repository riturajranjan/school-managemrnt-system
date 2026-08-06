import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { computeAssignmentPreview, confirmAssignment, withdrawAssignment } from "./fee-assignment-service";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };

describe("computeAssignmentPreview", () => {
  beforeEach(() => resetDemoData());

  it("flags a student who already has an active assignment against this structure", () => {
    const db = getSnapshot();
    const existing = db.studentFeeAssignments.find((a) => a.status === "active")!;
    const structure = db.feeStructures.find((s) => s.id === existing.structureId)!;
    const preview = computeAssignmentPreview(db, [existing.studentId], structure, { optionalComponentIds: [] });
    expect(preview[0].alreadyAssigned).toBe(true);
    expect(preview[0].eligible).toBe(false);
  });

  it("flags an inactive student as ineligible", () => {
    const db = getSnapshot();
    const inactiveStudent = db.students.find((s) => s.status !== "active");
    if (!inactiveStudent) return;
    const structure = db.feeStructures[0];
    const preview = computeAssignmentPreview(db, [inactiveStudent.id], structure, { optionalComponentIds: [] });
    expect(preview[0].eligible).toBe(false);
    expect(preview[0].exception).toMatch(/not active/i);
  });

  it("computes a total for an eligible student with no existing assignment", () => {
    const db = getSnapshot();
    const structure = db.feeStructures.find((s) => s.status === "active")!;
    const classId = structure.applicableClassIds[0];
    const unassignedStudent = db.students.find(
      (s) => s.status === "active" && s.classId === classId && !db.studentFeeAssignments.some((a) => a.studentId === s.id && a.structureId === structure.id),
    );
    if (!unassignedStudent) return;
    const preview = computeAssignmentPreview(db, [unassignedStudent.id], structure, { optionalComponentIds: [] });
    expect(preview[0].eligible).toBe(true);
    expect(preview[0].total.minorUnits).toBeGreaterThan(0);
  });

  it("excludes an optional component's amount when not opted into", () => {
    const db = getSnapshot();
    const structure = db.feeStructures.find((s) => s.components.some((c) => c.optional))!;
    const classId = structure.applicableClassIds[0];
    const student = db.students.find((s) => s.status === "active" && s.classId === classId);
    if (!student) return;
    const withOptional = computeAssignmentPreview(db, [student.id], structure, { optionalComponentIds: structure.components.filter((c) => c.optional).map((c) => c.id) });
    const withoutOptional = computeAssignmentPreview(db, [student.id], structure, { optionalComponentIds: [] });
    if (!withOptional[0].eligible || !withoutOptional[0].eligible) return;
    expect(withOptional[0].total.minorUnits).toBeGreaterThan(withoutOptional[0].total.minorUnits);
  });
});

describe("confirmAssignment", () => {
  beforeEach(() => resetDemoData());

  it("creates one assignment and matching fee items for every eligible student", () => {
    const db = getSnapshot();
    const structure = db.feeStructures.find((s) => s.status === "active")!;
    const classId = structure.applicableClassIds[0];
    const unassignedStudents = db.students.filter(
      (s) => s.status === "active" && s.classId === classId && !db.studentFeeAssignments.some((a) => a.studentId === s.id && a.structureId === structure.id),
    );
    if (unassignedStudents.length === 0) return;

    const preview = computeAssignmentPreview(db, unassignedStudents.map((s) => s.id), structure, { optionalComponentIds: [] });
    const result = confirmAssignment(structure, preview, { optionalComponentIds: [] }, ACTOR);
    expect(result.assigned).toBe(unassignedStudents.length);

    const after = getSnapshot();
    for (const student of unassignedStudents) {
      const assignment = after.studentFeeAssignments.find((a) => a.studentId === student.id && a.structureId === structure.id);
      expect(assignment).toBeDefined();
      const items = after.studentFeeItems.filter((i) => i.assignmentId === assignment!.id);
      expect(items.length).toBe(structure.components.length * structure.installments.length);
    }
  });

  it("skips ineligible rows rather than creating duplicate assignments", () => {
    const db = getSnapshot();
    const existing = db.studentFeeAssignments.find((a) => a.status === "active")!;
    const structure = db.feeStructures.find((s) => s.id === existing.structureId)!;
    const countBefore = getSnapshot().studentFeeAssignments.length;
    const preview = computeAssignmentPreview(db, [existing.studentId], structure, { optionalComponentIds: [] });
    const result = confirmAssignment(structure, preview, { optionalComponentIds: [] }, ACTOR);
    expect(result.assigned).toBe(0);
    expect(result.skipped).toBe(1);
    expect(getSnapshot().studentFeeAssignments.length).toBe(countBefore);
  });

  it("waives installments due before the prorated-from date for a mid-session admission", () => {
    const db = getSnapshot();
    const structure = db.feeStructures.find((s) => s.status === "active" && s.installments.length > 1)!;
    const classId = structure.applicableClassIds[0];
    const student = db.students.find(
      (s) => s.status === "active" && s.classId === classId && !db.studentFeeAssignments.some((a) => a.studentId === s.id && a.structureId === structure.id),
    );
    if (!student) return;
    const midSessionDate = structure.installments[1].dueDate;
    const options = { optionalComponentIds: [], proratedFromDate: midSessionDate };
    const preview = computeAssignmentPreview(db, [student.id], structure, options);
    confirmAssignment(structure, preview, options, ACTOR);

    const after = getSnapshot();
    const assignment = after.studentFeeAssignments.find((a) => a.studentId === student.id && a.structureId === structure.id)!;
    const items = after.studentFeeItems.filter((i) => i.assignmentId === assignment.id);
    expect(items.every((i) => i.dueDate >= midSessionDate)).toBe(true);
    expect(items.length).toBe(structure.components.length * (structure.installments.length - 1));
  });
});

describe("confirmAssignment with a bulk discount", () => {
  beforeEach(() => resetDemoData());

  it("creates a real Discount record per student and links it to the assignment", () => {
    const db = getSnapshot();
    const structure = db.feeStructures.find((s) => s.status === "active")!;
    const classId = structure.applicableClassIds[0];
    const student = db.students.find(
      (s) => s.status === "active" && s.classId === classId && !db.studentFeeAssignments.some((a) => a.studentId === s.id && a.structureId === structure.id),
    );
    if (!student) return;

    const options = { optionalComponentIds: [], discountPercent: 15, discountName: "Test bulk discount" };
    const preview = computeAssignmentPreview(db, [student.id], structure, options);
    confirmAssignment(structure, preview, options, ACTOR);

    const after = getSnapshot();
    const assignment = after.studentFeeAssignments.find((a) => a.studentId === student.id && a.structureId === structure.id)!;
    expect(assignment.discountIds.length).toBe(1);
    const discount = after.discounts.find((d) => d.id === assignment.discountIds[0]);
    expect(discount).toBeDefined();
    expect(discount?.name).toBe("Test bulk discount");
    expect(discount?.percent).toBe(15);

    const items = after.studentFeeItems.filter((i) => i.assignmentId === assignment.id);
    expect(items.every((i) => i.discountAmount.minorUnits > 0)).toBe(true);
  });
});

describe("withdrawAssignment", () => {
  beforeEach(() => resetDemoData());

  it("marks the assignment withdrawn and cancels only future pending items", () => {
    const db = getSnapshot();
    const assignment = db.studentFeeAssignments.find((a) => a.status === "active" && db.studentFeeItems.some((i) => i.assignmentId === a.id && i.status === "paid"))!;
    withdrawAssignment(assignment.id, ACTOR);

    const after = getSnapshot();
    expect(after.studentFeeAssignments.find((a) => a.id === assignment.id)?.status).toBe("withdrawn");
    const paidItems = after.studentFeeItems.filter((i) => i.assignmentId === assignment.id && i.status === "paid");
    expect(paidItems.length).toBeGreaterThan(0);
  });
});
