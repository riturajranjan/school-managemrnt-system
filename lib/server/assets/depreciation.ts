// Asset depreciation (production migration, Phase A) — book value is ALWAYS
// derived live from cost/method/rate/purchaseDate/salvageValue, never stored
// or "run" as a period-close step, and never posted to the Accounting
// Ledger (that integration stays deliberately out of scope — see the
// Asset model's doc comment). Pure function, no DB access, so it's trivially
// correct and testable in isolation.
export type DepreciationMethod = "none" | "straight_line" | "declining_balance";

export type DepreciationInput = {
  cost: number | null;
  purchaseDate: string | null; // YYYY-MM-DD
  method: DepreciationMethod;
  ratePercent: number | null; // annual rate, e.g. 20 = 20%/year
  salvageValue: number | null;
};

export type DepreciationResult = { accumulatedDepreciation: number; bookValue: number | null };

const round2 = (n: number) => Math.round(n * 100) / 100;

function yearsElapsed(purchaseDate: string, asOf: Date): number {
  const start = new Date(`${purchaseDate}T00:00:00.000Z`).getTime();
  const ms = asOf.getTime() - start;
  return Math.max(0, ms / (365.25 * 24 * 60 * 60 * 1000));
}

/** Real, live-computed book value. No stored "accumulated" ledger — recalculated on every read. */
export function computeDepreciation(input: DepreciationInput, asOf: Date = new Date()): DepreciationResult {
  if (input.cost === null) return { accumulatedDepreciation: 0, bookValue: null };
  if (input.method === "none" || !input.purchaseDate || !input.ratePercent) {
    return { accumulatedDepreciation: 0, bookValue: round2(input.cost) };
  }

  const salvage = input.salvageValue ?? 0;
  const years = yearsElapsed(input.purchaseDate, asOf);
  const rate = input.ratePercent / 100;

  let bookValue: number;
  if (input.method === "declining_balance") {
    bookValue = input.cost * (1 - rate) ** years;
  } else {
    const annualDepreciation = input.cost * rate;
    bookValue = input.cost - annualDepreciation * years;
  }

  bookValue = Math.max(salvage, Math.min(input.cost, bookValue));
  return { accumulatedDepreciation: round2(input.cost - bookValue), bookValue: round2(bookValue) };
}
