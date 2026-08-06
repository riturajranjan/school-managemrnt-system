import type { SalaryComponent, SalaryStructure } from "@/lib/types/payroll";
import { percentOfMoney, subtractMoney, sumMoney, zeroMoney, type Money } from "@/lib/finance/money";

export type ResolvedComponent = { component: SalaryComponent; amount: Money };

/** Resolves one salary component to a concrete Money value. Percentage
 * components (e.g. HRA = 40% of Basic) look up their base component within
 * the same structure — attendance-based proration is applied by the payroll
 * run, not here, since this resolver has no attendance context. */
export function resolveComponentAmount(component: SalaryComponent, components: SalaryComponent[], currency: Money["currency"]): Money {
  if (component.calcType === "percentage") {
    const base = components.find((c) => c.id === component.percentOfComponentId);
    if (base) return percentOfMoney(resolveComponentAmount(base, components, currency), component.percent ?? 0);
    return zeroMoney(currency);
  }
  return component.amount ?? zeroMoney(currency);
}

export type ResolvedStructure = {
  earnings: ResolvedComponent[];
  deductions: ResolvedComponent[];
  grossPay: Money;
  totalDeductions: Money;
  netPay: Money;
};

export function resolveSalaryStructure(structure: Pick<SalaryStructure, "components" | "currency">): ResolvedStructure {
  const resolved = structure.components.map((component) => ({ component, amount: resolveComponentAmount(component, structure.components, structure.currency) }));
  const earnings = resolved.filter((r) => r.component.category === "earning");
  const deductions = resolved.filter((r) => r.component.category === "deduction");
  const grossPay = sumMoney(earnings.map((e) => e.amount), structure.currency);
  const totalDeductions = sumMoney(deductions.map((d) => d.amount), structure.currency);
  return { earnings, deductions, grossPay, totalDeductions, netPay: subtractMoney(grossPay, totalDeductions) };
}

/** Prorates a fixed monthly amount down for partial attendance, e.g. a
 * teacher present 24 of 26 working days is paid 24/26 of each earning
 * component. Deductions that are attendance-based (rare) prorate the same
 * way; fixed statutory deductions (PF, tax) do not. */
export function prorateForAttendance(amount: Money, attendanceDays: number, workingDays: number): Money {
  if (workingDays <= 0 || attendanceDays >= workingDays) return amount;
  return { minorUnits: Math.round((amount.minorUnits * attendanceDays) / workingDays), currency: amount.currency };
}

export function grossAfterProration(structure: Pick<SalaryStructure, "components" | "currency">, attendanceDays: number, workingDays: number): { earnings: ResolvedComponent[]; grossPay: Money } {
  const { earnings } = resolveSalaryStructure(structure);
  const proratedEarnings = earnings.map((e) => ({ component: e.component, amount: e.component.calcType === "attendance-based" ? prorateForAttendance(e.amount, attendanceDays, workingDays) : e.amount }));
  return { earnings: proratedEarnings, grossPay: sumMoney(proratedEarnings.map((e) => e.amount), structure.currency) };
}
