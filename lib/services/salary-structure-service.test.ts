import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { moneyFromMajor } from "@/lib/finance/money";
import { createSalaryStructure, deactivateSalaryStructure, updateSalaryStructure } from "./salary-structure-service";
import type { SalaryStructureDraft } from "./salary-structure-service";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };

function draft(employeeId: string): SalaryStructureDraft {
  return {
    name: "Test structure",
    employeeId,
    session: "2026-2027",
    currency: "INR",
    effectiveFrom: "2026-08-01",
    components: [{ id: "sc-basic", name: "Basic", category: "earning", calcType: "fixed", amount: moneyFromMajor(40000, "INR"), taxable: true, recurring: true }],
  };
}

describe("salary-structure-service", () => {
  beforeEach(() => resetDemoData());

  it("creates an active structure with generated component ids", () => {
    const structure = createSalaryStructure(draft("teacher-999"), ACTOR);
    expect(structure.status).toBe("active");
    expect(structure.components[0].id).toBeTruthy();
    expect(getSnapshot().salaryStructures.some((s) => s.id === structure.id)).toBe(true);
  });

  it("supersedes a previously active structure for the same employee", () => {
    const first = createSalaryStructure(draft("teacher-888"), ACTOR);
    const second = createSalaryStructure(draft("teacher-888"), ACTOR);
    const db = getSnapshot();
    expect(db.salaryStructures.find((s) => s.id === first.id)?.status).toBe("inactive");
    expect(db.salaryStructures.find((s) => s.id === second.id)?.status).toBe("active");
  });

  it("updates a structure's name", () => {
    const structure = createSalaryStructure(draft("teacher-777"), ACTOR);
    const result = updateSalaryStructure(structure.id, { name: "Revised structure" }, ACTOR);
    expect(result.ok).toBe(true);
    expect(getSnapshot().salaryStructures.find((s) => s.id === structure.id)?.name).toBe("Revised structure");
  });

  it("deactivates a structure", () => {
    const structure = createSalaryStructure(draft("teacher-666"), ACTOR);
    const result = deactivateSalaryStructure(structure.id, ACTOR);
    expect(result.ok).toBe(true);
    expect(getSnapshot().salaryStructures.find((s) => s.id === structure.id)?.status).toBe("inactive");
  });

  it("refuses to update a non-existent structure", () => {
    expect(updateSalaryStructure("no-such-structure", { name: "X" }, ACTOR).ok).toBe(false);
  });
});
