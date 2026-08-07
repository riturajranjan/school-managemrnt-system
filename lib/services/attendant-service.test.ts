import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { createAttendant, setAttendantStatus, updateAttendant } from "./attendant-service";

const ACTOR = { name: "Transport Administrator", role: "Transport Administrator" };

describe("attendant-service", () => {
  beforeEach(() => resetDemoData());

  it("creates an attendant in available status", () => {
    const attendant = createAttendant({ name: "Test Attendant", employeeCode: "ATT-TEST-01", phone: "9822222222", joiningDate: "2024-01-01", branch: "main" }, ACTOR);
    expect(attendant.status).toBe("available");
    expect(getSnapshot().attendants.some((a) => a.id === attendant.id)).toBe(true);
  });

  it("updates an attendant's fields", () => {
    const attendant = createAttendant({ name: "Test Attendant", employeeCode: "ATT-TEST-02", phone: "9822222222", joiningDate: "2024-01-01", branch: "main" }, ACTOR);
    const result = updateAttendant(attendant.id, { phone: "9833333333" }, ACTOR);
    expect(result.ok).toBe(true);
    expect(getSnapshot().attendants.find((a) => a.id === attendant.id)?.phone).toBe("9833333333");
  });

  it("changes an attendant's status", () => {
    const attendant = createAttendant({ name: "Test Attendant", employeeCode: "ATT-TEST-03", phone: "9822222222", joiningDate: "2024-01-01", branch: "main" }, ACTOR);
    const result = setAttendantStatus(attendant.id, "on-leave", ACTOR);
    expect(result.ok).toBe(true);
    expect(getSnapshot().attendants.find((a) => a.id === attendant.id)?.status).toBe("on-leave");
  });

  it("refuses to update a non-existent attendant", () => {
    expect(updateAttendant("no-such-attendant", { phone: "1" }, ACTOR).ok).toBe(false);
  });
});
