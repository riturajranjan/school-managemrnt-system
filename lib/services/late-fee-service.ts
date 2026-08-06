import { getSnapshot, setState, type Db } from "@/lib/data/store";
import type { LateFeeRule, StudentFeeItem } from "@/lib/types/fees";
import { compareMoney, minMoney, multiplyMoney, percentOfMoney, subtractMoney, zeroMoney, type Money } from "@/lib/finance/money";
import { daysOverdue } from "@/lib/selectors/dues-insights";
import { netDueForItem } from "@/lib/selectors/fee-item-insights";
import { generateId } from "@/lib/utils";
import { logFinancialAudit } from "./finance-audit-service";

type Actor = { name: string; role: string };
export type LateFeeRuleDraft = Omit<LateFeeRule, "id" | "createdAt" | "updatedAt" | "status">;

export function createLateFeeRule(draft: LateFeeRuleDraft, actor: Actor): LateFeeRule {
  const now = new Date().toISOString();
  const rule: LateFeeRule = { ...draft, id: generateId("lfr"), status: "active", createdAt: now, updatedAt: now };
  setState((db) => ({ ...db, lateFeeRules: [...db.lateFeeRules, rule] }));
  logFinancialAudit({ action: "late-fee-rule-changed", actorName: actor.name, actorRole: actor.role, summary: `Late fee rule "${rule.name}" created.` });
  return rule;
}

export function updateLateFeeRule(ruleId: string, patch: Partial<LateFeeRuleDraft>, actor: Actor) {
  const rule = getSnapshot().lateFeeRules.find((r) => r.id === ruleId);
  setState((db) => ({ ...db, lateFeeRules: db.lateFeeRules.map((r) => (r.id === ruleId ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r)) }));
  if (rule) logFinancialAudit({ action: "late-fee-rule-changed", actorName: actor.name, actorRole: actor.role, summary: `Late fee rule "${rule.name}" updated.` });
}

export function setLateFeeRuleStatus(ruleId: string, status: LateFeeRule["status"], actor: Actor) {
  const rule = getSnapshot().lateFeeRules.find((r) => r.id === ruleId);
  setState((db) => ({ ...db, lateFeeRules: db.lateFeeRules.map((r) => (r.id === ruleId ? { ...r, status, updatedAt: new Date().toISOString() } : r)) }));
  if (rule) logFinancialAudit({ action: "late-fee-rule-changed", actorName: actor.name, actorRole: actor.role, summary: `Late fee rule "${rule.name}" marked ${status}.` });
}

/** Pure fine calculation for one overdue item against one rule — the grace
 * period is measured from the item's own due date, and the result is capped
 * at `maxCapAmount` when set. `amount` doubles as the per-period rate for
 * daily/weekly/monthly calc types, not just the flat "fixed" amount. */
export function calculateLateFee(rule: LateFeeRule, item: StudentFeeItem, today = new Date()): Money {
  const currency = item.billedAmount.currency;
  if (item.status !== "overdue") return zeroMoney(currency);
  const daysPastGrace = daysOverdue(item, today) - rule.gracePeriodDays;
  if (daysPastGrace <= 0) return zeroMoney(currency);

  let fine: Money;
  switch (rule.calcType) {
    case "fixed":
      fine = rule.amount ?? zeroMoney(currency);
      break;
    case "percentage":
      fine = percentOfMoney(netDueForItem(item), rule.percent ?? 0);
      break;
    case "daily":
      fine = multiplyMoney(rule.amount ?? zeroMoney(currency), daysPastGrace);
      break;
    case "weekly":
      fine = multiplyMoney(rule.amount ?? zeroMoney(currency), Math.ceil(daysPastGrace / 7));
      break;
    case "monthly":
      fine = multiplyMoney(rule.amount ?? zeroMoney(currency), Math.ceil(daysPastGrace / 30));
      break;
    case "slab": {
      const slab = (rule.slabs ?? []).find((s) => daysPastGrace >= s.fromDay && (s.toDay === undefined || daysPastGrace <= s.toDay));
      fine = slab?.amount ?? zeroMoney(currency);
      break;
    }
    default:
      fine = zeroMoney(currency);
  }

  return rule.maxCapAmount ? minMoney(fine, rule.maxCapAmount) : fine;
}

/** Picks the applicable rule for one item — a rule naming this item's class
 * or component specifically wins over a blanket rule (both empty lists), so
 * a school can override the default with a stricter or looser class-specific
 * policy. */
function ruleFor(db: Db, item: StudentFeeItem): LateFeeRule | undefined {
  const active = db.lateFeeRules.filter((r) => r.status === "active");
  const classId = db.students.find((s) => s.id === item.studentId)?.classId;
  const matchesComponent = (r: LateFeeRule) => r.applicableComponentIds.length === 0 || r.applicableComponentIds.includes(item.componentId);
  const matchesClass = (r: LateFeeRule) => r.applicableClassIds.length === 0 || (classId !== undefined && r.applicableClassIds.includes(classId));

  const specific = active.find((r) => matchesComponent(r) && matchesClass(r) && (r.applicableComponentIds.length > 0 || r.applicableClassIds.length > 0));
  return specific ?? active.find((r) => r.applicableComponentIds.length === 0 && r.applicableClassIds.length === 0);
}

export type RecalculateResult = { updated: number };

/** Recomputes fineAmount for every currently-overdue item against the active
 * rule set — idempotent, so running it repeatedly (e.g. on a schedule)
 * simply converges fines to what the rules say right now rather than
 * compounding. */
export function recalculateLateFees(actor: Actor): RecalculateResult {
  const db = getSnapshot();
  let updated = 0;
  setState((current) => ({
    ...current,
    studentFeeItems: current.studentFeeItems.map((item) => {
      if (item.status !== "overdue") return item;
      const rule = ruleFor(db, item);
      const fine = rule ? calculateLateFee(rule, item) : zeroMoney(item.billedAmount.currency);
      if (fine.minorUnits === item.fineAmount.minorUnits) return item;
      updated += 1;
      return { ...item, fineAmount: fine };
    }),
  }));
  if (updated > 0) {
    logFinancialAudit({ action: "fine-waived", actorName: actor.name, actorRole: actor.role, summary: `Late fees recalculated for ${updated} overdue item(s).` });
  }
  return { updated };
}

export function waiveFine(itemId: string, partial: Money | undefined, reason: string, actor: Actor): { ok: true } | { ok: false; error: string } {
  const db = getSnapshot();
  const item = db.studentFeeItems.find((i) => i.id === itemId);
  if (!item) return { ok: false, error: "Fee item not found." };
  if (item.fineAmount.minorUnits === 0) return { ok: false, error: "This item has no fine to waive." };

  const waiveAmount = partial && compareMoney(partial, item.fineAmount) < 0 ? partial : item.fineAmount;
  setState((current) => ({
    ...current,
    studentFeeItems: current.studentFeeItems.map((i) => (i.id === itemId ? { ...i, fineAmount: subtractMoney(i.fineAmount, waiveAmount) } : i)),
  }));

  logFinancialAudit({
    subjectId: item.studentId,
    action: "fine-waived",
    actorName: actor.name,
    actorRole: actor.role,
    summary: `Fine of ${waiveAmount.minorUnits / 100} ${waiveAmount.minorUnits === item.fineAmount.minorUnits ? "fully" : "partially"} waived on "${item.label}".`,
    reason,
  });
  return { ok: true };
}
