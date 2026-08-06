import { describe, expect, it } from "vitest";
import { validateComponentValue } from "./marks-service";

describe("validateComponentValue", () => {
  it("accepts a valid value within range", () => {
    expect(validateComponentValue(75, 100)).toHaveLength(0);
  });

  it("rejects a negative value", () => {
    expect(validateComponentValue(-5, 100)).toContain("Marks can't be negative.");
  });

  it("rejects a value above the component maximum", () => {
    const errors = validateComponentValue(105, 100);
    expect(errors.some((e) => e.includes("exceed"))).toBe(true);
  });

  it("rejects a non-numeric value", () => {
    expect(validateComponentValue(Number("abc"), 100)).toEqual(["Enter a number."]);
  });

  it("accepts up to 2 decimal places", () => {
    expect(validateComponentValue(87.5, 100)).toHaveLength(0);
    expect(validateComponentValue(87.55, 100)).toHaveLength(0);
  });

  it("rejects more than 2 decimal places", () => {
    const errors = validateComponentValue(87.555, 100);
    expect(errors.some((e) => e.includes("decimal"))).toBe(true);
  });

  it("accepts exactly the maximum", () => {
    expect(validateComponentValue(100, 100)).toHaveLength(0);
  });

  it("accepts zero", () => {
    expect(validateComponentValue(0, 100)).toHaveLength(0);
  });
});
