/** Decimal-safe money handling for the whole finance module.
 *
 * Every amount in the finance domain is stored as an INTEGER count of minor
 * currency units (paise for INR, cents for USD/GBP/AED, fils for AED's
 * sub-unit, etc.) — never a JavaScript float. `0.1 + 0.2 !== 0.3` is exactly
 * the kind of bug that must never reach a fee ledger, so all arithmetic here
 * operates on integers and only converts to/from a "major unit" decimal
 * string at the UI boundary (form inputs, display).
 */

export type CurrencyCode = "INR" | "USD" | "GBP" | "AED";

export type Money = {
  /** Integer count of minor units. Always a whole number — fractional minor
   * units are meaningless (you can't have half a paisa). */
  minorUnits: number;
  currency: CurrencyCode;
};

/** Digits after the decimal point for each supported currency's minor unit.
 * Kept as a lookup (not assumed to always be 2) since real-world currencies
 * vary — e.g. a future JPY (0 digits) or BHD (3 digits) addition only needs
 * an entry here, not a rewrite of the arithmetic. */
export const CURRENCY_MINOR_DIGITS: Record<CurrencyCode, number> = {
  INR: 2,
  USD: 2,
  GBP: 2,
  AED: 2,
};

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  INR: "₹",
  USD: "$",
  GBP: "£",
  AED: "AED ",
};

export const CURRENCY_LOCALES: Record<CurrencyCode, string> = {
  INR: "en-IN",
  USD: "en-US",
  GBP: "en-GB",
  AED: "ar-AE",
};

export const supportedCurrencies: CurrencyCode[] = ["INR", "USD", "GBP", "AED"];

function assertSameCurrency(a: Money, b: Money) {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: cannot combine ${a.currency} with ${b.currency}.`);
  }
}

export function zeroMoney(currency: CurrencyCode): Money {
  return { minorUnits: 0, currency };
}

/** Builds Money from a "major unit" decimal value (e.g. 4200.5 rupees) —
 * the only place a fractional JS number is allowed, and only because it's
 * immediately rounded to an integer minor-unit count. */
export function moneyFromMajor(amountMajor: number, currency: CurrencyCode): Money {
  const digits = CURRENCY_MINOR_DIGITS[currency];
  return { minorUnits: Math.round(amountMajor * 10 ** digits), currency };
}

export function moneyFromMinor(minorUnits: number, currency: CurrencyCode): Money {
  return { minorUnits: Math.round(minorUnits), currency };
}

export function toMajorUnits(m: Money): number {
  const digits = CURRENCY_MINOR_DIGITS[m.currency];
  return m.minorUnits / 10 ** digits;
}

/** Parses a user-typed amount string (e.g. from an <input type="number">
 * or a pasted "4,200.50"). Returns null for anything that isn't a valid,
 * non-negative amount so callers can show a validation error instead of
 * silently coercing garbage to 0. */
export function parseMoneyInput(raw: string, currency: CurrencyCode): Money | null {
  const cleaned = raw.replace(/,/g, "").trim();
  if (cleaned === "" || Number.isNaN(Number(cleaned))) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return moneyFromMajor(value, currency);
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { minorUnits: a.minorUnits + b.minorUnits, currency: a.currency };
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { minorUnits: a.minorUnits - b.minorUnits, currency: a.currency };
}

export function sumMoney(items: Money[], currency: CurrencyCode): Money {
  return items.reduce((total, m) => addMoney(total, m), zeroMoney(currency));
}

/** Multiplies by a plain factor (e.g. a quantity, or a rate like 0.18 for
 * 18% tax) and rounds to the nearest minor unit — the only rounding point
 * in the whole system, so results are always bank-safe integers again. */
export function multiplyMoney(a: Money, factor: number): Money {
  return { minorUnits: Math.round(a.minorUnits * factor), currency: a.currency };
}

export function percentOfMoney(a: Money, percent: number): Money {
  return multiplyMoney(a, percent / 100);
}

export function isZero(a: Money): boolean {
  return a.minorUnits === 0;
}

export function isNegative(a: Money): boolean {
  return a.minorUnits < 0;
}

export function isPositive(a: Money): boolean {
  return a.minorUnits > 0;
}

export function compareMoney(a: Money, b: Money): number {
  assertSameCurrency(a, b);
  return a.minorUnits - b.minorUnits;
}

export function maxMoney(a: Money, b: Money): Money {
  return compareMoney(a, b) >= 0 ? a : b;
}

export function minMoney(a: Money, b: Money): Money {
  return compareMoney(a, b) <= 0 ? a : b;
}

/** Clamps to zero — used anywhere a "remaining balance" must never go
 * negative in the display even if intermediate arithmetic briefly does. */
export function clampNonNegative(a: Money): Money {
  return a.minorUnits < 0 ? zeroMoney(a.currency) : a;
}

/** Splits an amount into `parts` roughly-equal shares whose sum is exactly
 * equal to the original — the remainder (a difference of at most `parts - 1`
 * minor units caused by integer division) is distributed one minor unit at a
 * time to the first shares, so nothing is ever lost or invented by rounding.
 * Used for installment plans and for splitting a single payment across the
 * fee items it settles. */
export function splitEvenly(total: Money, parts: number): Money[] {
  if (parts <= 0) return [];
  const base = Math.floor(total.minorUnits / parts);
  const remainder = total.minorUnits - base * parts;
  return Array.from({ length: parts }, (_, i) => ({ minorUnits: base + (i < remainder ? 1 : 0), currency: total.currency }));
}

export function formatMoney(m: Money, options?: { compact?: boolean }): string {
  const major = toMajorUnits(m);
  if (options?.compact) {
    const abs = Math.abs(major);
    const symbol = CURRENCY_SYMBOLS[m.currency];
    if (abs >= 10000000) return `${symbol}${(major / 10000000).toFixed(2)}Cr`;
    if (abs >= 100000) return `${symbol}${(major / 100000).toFixed(2)}L`;
    if (abs >= 1000) return `${symbol}${(major / 1000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat(CURRENCY_LOCALES[m.currency], {
    style: "currency",
    currency: m.currency,
    minimumFractionDigits: CURRENCY_MINOR_DIGITS[m.currency],
    maximumFractionDigits: CURRENCY_MINOR_DIGITS[m.currency],
  }).format(major);
}
