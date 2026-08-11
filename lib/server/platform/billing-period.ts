// Calendar-aware billing-period math (Super Admin SA-4B). Adds a Plan's billing
// interval to a date in UTC — a real month/year step (not a flat 30/365 days),
// with end-of-month day clamping (e.g. Jan 31 + 1 month → Feb 28/29).
import type { BillingInterval } from "@/lib/generated/prisma/enums";

function addMonthsUtc(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const targetMonth = d.getUTCMonth() + months;
  const day = d.getUTCDate();
  // Move to the first of the target month, then clamp the day to that month's length.
  d.setUTCDate(1);
  d.setUTCMonth(targetMonth);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/** Period end for one billing interval starting at `start`. */
export function periodEnd(start: Date, interval: BillingInterval): Date {
  return interval === "YEARLY" ? addMonthsUtc(start, 12) : addMonthsUtc(start, 1);
}

/** Add N whole days (used for trial windows). */
export function addDays(start: Date, days: number): Date {
  const d = new Date(start.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
