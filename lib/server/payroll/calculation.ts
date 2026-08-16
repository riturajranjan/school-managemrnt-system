// Payroll calculation engine (Phase 9H) — server-authoritative, Decimal-safe.
// A SalaryStructure's PERCENTAGE lines can only reference a FIXED line in the
// SAME structure (enforced in structures.ts), so every line resolves in one
// pass — no chains, no cycles to detect.
import { prisma } from "@/lib/db/prisma";
import { dec } from "@/lib/server/fees/money";

const round2 = (n: number) => Math.round(n * 100) / 100;

export type ResolvedComponentLine = { componentId: string; componentCode: string; componentName: string; type: "EARNING" | "DEDUCTION"; amount: number };

export async function resolveStructureComponents(salaryStructureId: string): Promise<ResolvedComponentLine[]> {
  const lines = await prisma.salaryStructureComponent.findMany({
    where: { salaryStructureId },
    orderBy: { order: "asc" },
    select: { id: true, salaryComponentId: true, amount: true, percent: true, percentOfLineId: true, salaryComponent: { select: { code: true, name: true, type: true } } },
  });
  const byLineId = new Map(lines.map((l) => [l.id, l]));

  return lines.map((l) => {
    const amount = l.amount !== null ? dec(l.amount) : round2((dec(byLineId.get(l.percentOfLineId!)!.amount) * dec(l.percent)) / 100);
    return { componentId: l.salaryComponentId, componentCode: l.salaryComponent.code, componentName: l.salaryComponent.name, type: l.salaryComponent.type as "EARNING" | "DEDUCTION", amount };
  });
}

/** grossEarnings = sum(EARNING), totalDeductions = sum(DEDUCTION), netPay = gross - deductions. */
export function summarizeLines(lines: { type: "EARNING" | "DEDUCTION"; amount: number }[]): { grossEarnings: number; totalDeductions: number; netPay: number } {
  const grossEarnings = Math.round(lines.filter((l) => l.type === "EARNING").reduce((s, l) => s + l.amount, 0) * 100) / 100;
  const totalDeductions = Math.round(lines.filter((l) => l.type === "DEDUCTION").reduce((s, l) => s + l.amount, 0) * 100) / 100;
  return { grossEarnings, totalDeductions, netPay: Math.round((grossEarnings - totalDeductions) * 100) / 100 };
}
