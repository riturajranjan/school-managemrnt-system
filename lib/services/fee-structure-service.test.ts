import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { moneyFromMajor } from "@/lib/finance/money";
import {
  archiveFeeStructure,
  copyFromPreviousSession,
  createFeeStructure,
  duplicateFeeStructure,
  previewStudentBill,
  updateFeeStructure,
  validateFeeStructure,
  type FeeStructureDraft,
} from "./fee-structure-service";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };

function draft(overrides: Partial<FeeStructureDraft> = {}): FeeStructureDraft {
  const tuition = { id: "fc-1", type: "tuition" as const, label: "Tuition fee", amount: moneyFromMajor(40000, "INR"), taxable: false, refundable: false, optional: false };
  return {
    name: "Test Structure",
    session: "2099-2100",
    branch: "main",
    applicableClassIds: ["class-test-only"],
    applicableSectionIds: [],
    admissionType: "all",
    components: [tuition],
    frequency: "quarterly",
    installments: [
      { id: "fi-1", label: "Installment 1", dueDate: "2099-06-15", amount: moneyFromMajor(20000, "INR"), componentIds: [] },
      { id: "fi-2", label: "Installment 2", dueDate: "2099-09-15", amount: moneyFromMajor(20000, "INR"), componentIds: [] },
    ],
    gracePeriodDays: 10,
    discountCompatible: true,
    prorationRule: "none",
    currency: "INR",
    createdBy: ACTOR.name,
    ...overrides,
  };
}

describe("validateFeeStructure", () => {
  beforeEach(() => resetDemoData());

  it("accepts a well-formed structure whose installments sum to the component total", () => {
    const db = getSnapshot();
    const result = validateFeeStructure(draft(), db);
    expect(result.valid).toBe(true);
  });

  it("rejects a negative component amount", () => {
    const db = getSnapshot();
    const bad = draft({ components: [{ id: "fc-1", type: "tuition", label: "Tuition", amount: { minorUnits: -100, currency: "INR" }, taxable: false, refundable: false, optional: false }] });
    const result = validateFeeStructure(bad, db);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("negative"))).toBe(true);
  });

  it("rejects installments whose total does not match the component total", () => {
    const db = getSnapshot();
    const bad = draft({ installments: [{ id: "fi-1", label: "Installment 1", dueDate: "2099-06-15", amount: moneyFromMajor(10000, "INR"), componentIds: [] }] });
    const result = validateFeeStructure(bad, db);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Installment total"))).toBe(true);
  });

  it("rejects two installments sharing the same due date", () => {
    const db = getSnapshot();
    const bad = draft({
      installments: [
        { id: "fi-1", label: "Installment 1", dueDate: "2099-06-15", amount: moneyFromMajor(20000, "INR"), componentIds: [] },
        { id: "fi-2", label: "Installment 2", dueDate: "2099-06-15", amount: moneyFromMajor(20000, "INR"), componentIds: [] },
      ],
    });
    const result = validateFeeStructure(bad, db);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("same due date"))).toBe(true);
  });

  it("rejects two non-custom components of the same type", () => {
    const db = getSnapshot();
    const amount = moneyFromMajor(20000, "INR");
    const bad = draft({
      components: [
        { id: "fc-1", type: "tuition", label: "Tuition A", amount, taxable: false, refundable: false, optional: false },
        { id: "fc-2", type: "tuition", label: "Tuition B", amount, taxable: false, refundable: false, optional: false },
      ],
      installments: [{ id: "fi-1", label: "Installment 1", dueDate: "2099-06-15", amount: moneyFromMajor(40000, "INR"), componentIds: [] }],
    });
    const result = validateFeeStructure(bad, db);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("more than one"))).toBe(true);
  });

  it("rejects a tax percent set on a non-taxable component", () => {
    const db = getSnapshot();
    const bad = draft({ components: [{ id: "fc-1", type: "tuition", label: "Tuition", amount: moneyFromMajor(40000, "INR"), taxable: false, taxPercent: 18, refundable: false, optional: false }] });
    const result = validateFeeStructure(bad, db);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("not marked taxable"))).toBe(true);
  });

  it("rejects a second active structure overlapping an already-covered class in the same session", () => {
    const db = getSnapshot();
    const existingActive = db.feeStructures.find((s) => s.status === "active")!;
    const overlapping = draft({ session: existingActive.session, applicableClassIds: [existingActive.applicableClassIds[0]], status: "active" });
    const result = validateFeeStructure(overlapping, db);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("already covers"))).toBe(true);
  });
});

describe("createFeeStructure / updateFeeStructure / archiveFeeStructure", () => {
  beforeEach(() => resetDemoData());

  it("persists a valid structure as a draft by default", () => {
    const result = createFeeStructure(draft(), ACTOR);
    expect("structure" in result).toBe(true);
    if ("structure" in result) {
      expect(result.structure.status).toBe("draft");
      expect(getSnapshot().feeStructures.some((s) => s.id === result.structure.id)).toBe(true);
    }
  });

  it("refuses to persist an invalid structure", () => {
    const countBefore = getSnapshot().feeStructures.length;
    const result = createFeeStructure(draft({ installments: [] }), ACTOR);
    expect("errors" in result).toBe(true);
    expect(getSnapshot().feeStructures.length).toBe(countBefore);
  });

  it("updates a structure and re-validates the merged result", () => {
    const created = createFeeStructure(draft(), ACTOR);
    if (!("structure" in created)) throw new Error("setup failed");
    const result = updateFeeStructure(created.structure.id, { name: "Renamed Structure" }, ACTOR);
    expect("structure" in result).toBe(true);
    if ("structure" in result) expect(result.structure.name).toBe("Renamed Structure");
  });

  it("archives a structure without deleting it", () => {
    const created = createFeeStructure(draft(), ACTOR);
    if (!("structure" in created)) throw new Error("setup failed");
    archiveFeeStructure(created.structure.id, ACTOR);
    const after = getSnapshot().feeStructures.find((s) => s.id === created.structure.id);
    expect(after?.status).toBe("archived");
  });
});

describe("duplicateFeeStructure / copyFromPreviousSession", () => {
  beforeEach(() => resetDemoData());

  it("duplicates a structure as a new draft with fresh component ids", () => {
    const source = getSnapshot().feeStructures[0];
    const copy = duplicateFeeStructure(source.id, ACTOR);
    expect(copy).toBeDefined();
    expect(copy?.name).toBe(`Copy of ${source.name}`);
    expect(copy?.status).toBe("draft");
    expect(copy?.components[0].id).not.toBe(source.components[0].id);
  });

  it("copies a structure into a new session and links it to the source via previousVersionId", () => {
    const source = getSnapshot().feeStructures[0];
    const copy = copyFromPreviousSession(source.id, "2099-2100", ACTOR);
    expect(copy?.session).toBe("2099-2100");
    expect(copy?.previousVersionId).toBe(source.id);
  });
});

describe("previewStudentBill", () => {
  beforeEach(() => resetDemoData());

  it("excludes an optional component the student did not opt into", () => {
    const structure = getSnapshot().feeStructures.find((s) => s.components.some((c) => c.optional))!;
    const preview = previewStudentBill(structure, []);
    expect(preview.components.every((c) => !c.optional)).toBe(true);
  });

  it("includes an optional component the student opted into", () => {
    const structure = getSnapshot().feeStructures.find((s) => s.components.some((c) => c.optional))!;
    const optionalComponent = structure.components.find((c) => c.optional)!;
    const preview = previewStudentBill(structure, [optionalComponent.id]);
    expect(preview.components.some((c) => c.id === optionalComponent.id)).toBe(true);
  });
});
