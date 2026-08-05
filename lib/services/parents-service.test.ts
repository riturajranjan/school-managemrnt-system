import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { setPrimaryGuardian, updatePickupAuthorization } from "./parents-service";

describe("setPrimaryGuardian", () => {
  beforeEach(() => resetDemoData());

  it("makes exactly one guardian link primary for a student", () => {
    const student = getSnapshot().students.find((s) => s.guardianIds.length > 1)!;
    const [, secondGuardianId] = student.guardianIds;

    setPrimaryGuardian(student.id, secondGuardianId);

    const db = getSnapshot();
    const links = db.studentGuardianLinks.filter((l) => l.studentId === student.id);
    const primaryLinks = links.filter((l) => l.isPrimary);
    expect(primaryLinks).toHaveLength(1);
    expect(primaryLinks[0].guardianId).toBe(secondGuardianId);
    expect(db.students.find((s) => s.id === student.id)?.primaryGuardianId).toBe(secondGuardianId);
  });
});

describe("updatePickupAuthorization", () => {
  beforeEach(() => resetDemoData());

  it("toggles authorized-pickup for exactly the targeted student-guardian link", () => {
    const link = getSnapshot().studentGuardianLinks[0];

    updatePickupAuthorization(link.studentId, link.guardianId, !link.isAuthorizedPickup);

    const updatedLink = getSnapshot().studentGuardianLinks.find(
      (l) => l.studentId === link.studentId && l.guardianId === link.guardianId,
    );
    expect(updatedLink?.isAuthorizedPickup).toBe(!link.isAuthorizedPickup);
  });
});
