import type { Asset, DepreciationMethod } from "@/lib/types/assets";
import { clampNonNegative, maxMoney, moneyFromMinor, subtractMoney, type Money } from "@/lib/finance/money";

/** Book value of an asset after `periods` whole periods (years), computed with
 * decimal-safe integer minor-unit arithmetic — never floating-point, per the
 * Phase 7 requirement. Book value never drops below salvage value. */
export function bookValueAfter(cost: Money, salvage: Money, usefulLifeYears: number, method: DepreciationMethod, periods: number): Money {
  if (method === "none" || usefulLifeYears <= 0) return cost;
  const clampedPeriods = Math.max(0, Math.min(periods, usefulLifeYears));

  if (method === "straight-line") {
    const depreciableBase = Math.max(0, cost.minorUnits - salvage.minorUnits);
    // Per-period charge is an integer count of minor units; remainder lands in the final period.
    const perPeriod = Math.floor(depreciableBase / usefulLifeYears);
    const accumulated = clampedPeriods >= usefulLifeYears ? depreciableBase : perPeriod * clampedPeriods;
    return moneyFromMinor(cost.minorUnits - accumulated, cost.currency);
  }

  // Declining balance at double the straight-line rate, floored at salvage.
  const rate = 2 / usefulLifeYears;
  let value = cost.minorUnits;
  for (let i = 0; i < clampedPeriods; i++) {
    const charge = Math.round(value * rate);
    value = Math.max(salvage.minorUnits, value - charge);
  }
  return moneyFromMinor(value, cost.currency);
}

export function accumulatedDepreciation(cost: Money, salvage: Money, usefulLifeYears: number, method: DepreciationMethod, periods: number): Money {
  const book = bookValueAfter(cost, salvage, usefulLifeYears, method, periods);
  return clampNonNegative(subtractMoney(cost, book));
}

/** Whole periods (years) elapsed since the depreciation start date, as of `asOf`. */
export function periodsElapsed(depreciationStartDate: string, asOf: string): number {
  const start = new Date(depreciationStartDate.slice(0, 10));
  const end = new Date(asOf.slice(0, 10));
  const years = (end.getTime() - start.getTime()) / (365.25 * 86_400_000);
  return Math.max(0, Math.floor(years));
}

export function currentBookValue(asset: Asset, asOf = new Date().toISOString().slice(0, 10)): Money {
  const periods = periodsElapsed(asset.depreciationStartDate, asOf);
  return maxMoney(bookValueAfter(asset.cost, asset.salvageValue, asset.usefulLifeYears, asset.depreciationMethod, periods), asset.salvageValue);
}
