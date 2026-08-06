import { describe, expect, it } from "vitest";
import { moneyFromMajor } from "@/lib/finance/money";
import { grossAfterProration, prorateForAttendance, resolveSalaryStructure } from "./salary-calc";
import type { SalaryStructure } from "@/lib/types/payroll";

function structure(): Pick<SalaryStructure, "components" | "currency"> {
  return {
    currency: "INR",
    components: [
      { id: "basic", name: "Basic", category: "earning", calcType: "fixed", amount: moneyFromMajor(40000, "INR"), taxable: true, recurring: true },
      { id: "hra", name: "HRA", category: "earning", calcType: "percentage", percent: 40, percentOfComponentId: "basic", taxable: true, recurring: true },
      { id: "pf", name: "Provident Fund", category: "deduction", calcType: "percentage", percent: 12, percentOfComponentId: "basic", taxable: false, recurring: true },
    ],
  };
}

describe("resolveSalaryStructure", () => {
  it("resolves percentage components against their base and computes gross/net", () => {
    const resolved = resolveSalaryStructure(structure());
    expect(resolved.grossPay.minorUnits).toBe(moneyFromMajor(56000, "INR").minorUnits);
    expect(resolved.totalDeductions.minorUnits).toBe(moneyFromMajor(4800, "INR").minorUnits);
    expect(resolved.netPay.minorUnits).toBe(moneyFromMajor(51200, "INR").minorUnits);
  });
});

describe("prorateForAttendance", () => {
  it("prorates proportionally to attendance days", () => {
    const prorated = prorateForAttendance(moneyFromMajor(26000, "INR"), 13, 26);
    expect(prorated.minorUnits).toBe(moneyFromMajor(13000, "INR").minorUnits);
  });

  it("returns the full amount when attendance equals or exceeds working days", () => {
    const prorated = prorateForAttendance(moneyFromMajor(26000, "INR"), 26, 26);
    expect(prorated.minorUnits).toBe(moneyFromMajor(26000, "INR").minorUnits);
  });
});

describe("grossAfterProration", () => {
  it("only prorates attendance-based earning components, leaving fixed ones untouched", () => {
    const withAttendance: Pick<SalaryStructure, "components" | "currency"> = {
      currency: "INR",
      components: [
        { id: "basic", name: "Basic", category: "earning", calcType: "fixed", amount: moneyFromMajor(26000, "INR"), taxable: true, recurring: true },
        { id: "conv", name: "Conveyance", category: "earning", calcType: "attendance-based", amount: moneyFromMajor(2600, "INR"), taxable: false, recurring: true },
      ],
    };
    const result = grossAfterProration(withAttendance, 13, 26);
    expect(result.earnings.find((e) => e.component.id === "basic")?.amount.minorUnits).toBe(moneyFromMajor(26000, "INR").minorUnits);
    expect(result.earnings.find((e) => e.component.id === "conv")?.amount.minorUnits).toBe(moneyFromMajor(1300, "INR").minorUnits);
  });
});
