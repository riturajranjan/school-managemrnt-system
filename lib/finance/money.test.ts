import { describe, expect, it } from "vitest";
import {
  addMoney,
  clampNonNegative,
  compareMoney,
  formatMoney,
  isNegative,
  isZero,
  moneyFromMajor,
  moneyFromMinor,
  multiplyMoney,
  parseMoneyInput,
  percentOfMoney,
  splitEvenly,
  subtractMoney,
  sumMoney,
  toMajorUnits,
  zeroMoney,
} from "./money";

describe("moneyFromMajor / toMajorUnits", () => {
  it("round-trips a decimal rupee amount through integer paise without float drift", () => {
    const m = moneyFromMajor(4200.5, "INR");
    expect(m.minorUnits).toBe(420050);
    expect(toMajorUnits(m)).toBe(4200.5);
  });

  it("never produces the classic 0.1 + 0.2 float error across repeated addition", () => {
    let total = zeroMoney("INR");
    for (let i = 0; i < 10; i++) total = addMoney(total, moneyFromMajor(0.1, "INR"));
    expect(toMajorUnits(total)).toBe(1);
  });
});

describe("addMoney / subtractMoney", () => {
  it("adds two amounts in the same currency", () => {
    const result = addMoney(moneyFromMajor(100, "INR"), moneyFromMajor(50, "INR"));
    expect(toMajorUnits(result)).toBe(150);
  });

  it("throws on a currency mismatch instead of silently combining", () => {
    expect(() => addMoney(moneyFromMajor(100, "INR"), moneyFromMajor(100, "USD"))).toThrow(/currency mismatch/i);
  });

  it("subtracts and can go negative, which callers clamp explicitly", () => {
    const result = subtractMoney(moneyFromMajor(50, "INR"), moneyFromMajor(80, "INR"));
    expect(toMajorUnits(result)).toBe(-30);
    expect(isNegative(result)).toBe(true);
    expect(toMajorUnits(clampNonNegative(result))).toBe(0);
  });
});

describe("sumMoney", () => {
  it("sums a list of amounts, defaulting to zero for an empty list", () => {
    expect(toMajorUnits(sumMoney([], "INR"))).toBe(0);
    const sum = sumMoney([moneyFromMajor(10, "INR"), moneyFromMajor(20.25, "INR"), moneyFromMajor(5, "INR")], "INR");
    expect(toMajorUnits(sum)).toBe(35.25);
  });
});

describe("multiplyMoney / percentOfMoney", () => {
  it("rounds to the nearest minor unit after multiplying", () => {
    const result = multiplyMoney(moneyFromMinor(333, "INR"), 3);
    expect(result.minorUnits).toBe(999);
  });

  it("computes a percentage of an amount", () => {
    const tax = percentOfMoney(moneyFromMajor(1000, "INR"), 18);
    expect(toMajorUnits(tax)).toBe(180);
  });
});

describe("compareMoney / isZero", () => {
  it("compares two amounts in the same currency", () => {
    expect(compareMoney(moneyFromMajor(100, "INR"), moneyFromMajor(50, "INR"))).toBeGreaterThan(0);
    expect(compareMoney(moneyFromMajor(50, "INR"), moneyFromMajor(100, "INR"))).toBeLessThan(0);
    expect(compareMoney(moneyFromMajor(50, "INR"), moneyFromMajor(50, "INR"))).toBe(0);
  });

  it("recognizes a zero amount", () => {
    expect(isZero(zeroMoney("INR"))).toBe(true);
    expect(isZero(moneyFromMajor(0.01, "INR"))).toBe(false);
  });
});

describe("parseMoneyInput", () => {
  it("parses a comma-formatted decimal string", () => {
    const parsed = parseMoneyInput("4,200.50", "INR");
    expect(parsed?.minorUnits).toBe(420050);
  });

  it("rejects empty, negative, and non-numeric input", () => {
    expect(parseMoneyInput("", "INR")).toBeNull();
    expect(parseMoneyInput("-100", "INR")).toBeNull();
    expect(parseMoneyInput("abc", "INR")).toBeNull();
  });
});

describe("splitEvenly", () => {
  it("splits an amount that divides evenly", () => {
    const parts = splitEvenly(moneyFromMajor(400, "INR"), 4);
    expect(parts.map((p) => toMajorUnits(p))).toEqual([100, 100, 100, 100]);
  });

  it("distributes the remainder to the first shares so the total is exact, never lost", () => {
    const total = moneyFromMinor(100, "INR");
    const parts = splitEvenly(total, 3);
    expect(parts.map((p) => p.minorUnits)).toEqual([34, 33, 33]);
    expect(parts.reduce((sum, p) => sum + p.minorUnits, 0)).toBe(100);
  });

  it("returns an empty array for zero or negative parts", () => {
    expect(splitEvenly(moneyFromMajor(100, "INR"), 0)).toEqual([]);
  });
});

describe("formatMoney", () => {
  it("formats INR with the rupee symbol and two decimal places", () => {
    const formatted = formatMoney(moneyFromMajor(4200.5, "INR"));
    expect(formatted).toContain("4,200.50");
  });

  it("compact mode abbreviates large amounts", () => {
    expect(formatMoney(moneyFromMajor(150000, "INR"), { compact: true })).toBe("₹1.50L");
    expect(formatMoney(moneyFromMajor(12500000, "INR"), { compact: true })).toBe("₹1.25Cr");
  });
});
