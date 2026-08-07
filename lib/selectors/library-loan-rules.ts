import type { LibraryRule, MemberType, ResourceType } from "@/lib/types/library";
import { clampNonNegative, minMoney, moneyFromMinor, multiplyMoney, zeroMoney, type Money } from "@/lib/finance/money";

/** Whole calendar days between two ISO dates (b − a), floored to an integer.
 * Used for loan duration / overdue arithmetic — never money, so plain
 * numbers are fine here. */
export function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso.slice(0, 10)).getTime();
  const b = new Date(bIso.slice(0, 10)).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso.slice(0, 10));
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Picks the lending policy that governs a (memberType, resourceType,
 * category) tuple. Specificity wins: a rule that names the category beats one
 * that only names the resource type, which beats the tenant-wide fallback.
 * Ties break on the explicit `priority` field (higher first). Returns null if
 * not even a fallback rule exists so the caller blocks the loan rather than
 * inventing limits. */
export function matchLoanRule(
  rules: LibraryRule[],
  ctx: { memberType: MemberType; resourceType: ResourceType; categoryId?: string },
): LibraryRule | null {
  const candidates = rules.filter(
    (r) =>
      (r.memberType === undefined || r.memberType === ctx.memberType) &&
      (r.resourceType === undefined || r.resourceType === ctx.resourceType) &&
      (r.categoryId === undefined || r.categoryId === ctx.categoryId),
  );
  if (candidates.length === 0) return null;

  function specificity(r: LibraryRule): number {
    return (r.memberType ? 1 : 0) + (r.resourceType ? 1 : 0) + (r.categoryId ? 1 : 0);
  }
  return [...candidates].sort((a, b) => specificity(b) - specificity(a) || b.priority - a.priority)[0];
}

/** Days a loan is overdue as of `asOf`, honouring the rule's grace period.
 * Returns 0 while inside the grace window. */
export function overdueDays(dueDate: string, asOf: string, gracePeriodDays: number): number {
  const raw = daysBetween(addDays(dueDate, gracePeriodDays), asOf);
  return Math.max(0, raw);
}

/** Overdue fine, decimal-safe and capped at the rule's maxFine. finePerDay is
 * already Money (integer minor units) so this never touches a float. */
export function overdueFine(rule: LibraryRule, days: number): Money {
  if (days <= 0) return zeroMoney(rule.finePerDay.currency);
  const raw = multiplyMoney(rule.finePerDay, days);
  const capped = rule.maxFine.minorUnits > 0 ? minMoney(raw, rule.maxFine) : raw;
  return clampNonNegative(moneyFromMinor(capped.minorUnits, capped.currency));
}
