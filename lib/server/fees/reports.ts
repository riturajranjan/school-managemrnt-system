// Fee Reports (Phase 9F) — every total here is DB-derived from the same real
// FeePayment/FeeAdjustment/FeeRefund/FeeCharge rows Collection/Dues use.
// No separate frontend formula, no mock fallback, honest empty states.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import type {
  FeeAdjustmentReportDto,
  FeeCollectionReportDto,
  FeeDashboardDto,
  FeeOutstandingReportDto,
  FeePaymentMethodDto,
  FeeReconciliationReportDto,
  FeeRefundReportDto,
} from "@/lib/api/contracts";
import { computeCharge } from "./balance";
import { dec } from "./money";

function requireSession(scope: OrgScope): string {
  if (!scope.academicSessionId) throw new HttpError("INVALID_SESSION", "Select an academic session first");
  return scope.academicSessionId;
}

const METHOD_TO_UI: Record<string, FeePaymentMethodDto> = { CASH: "cash", UPI: "upi", CARD: "card", BANK_TRANSFER: "bank_transfer", CHEQUE: "cheque", OTHER: "other" };

export async function getFeeCollectionReport(scope: OrgScope, params: { from?: string; to?: string } = {}): Promise<FeeCollectionReportDto> {
  const sessionId = requireSession(scope);
  const where: Prisma.FeePaymentWhereInput = {
    schoolId: scope.schoolId, academicSessionId: sessionId,
    ...(params.from || params.to ? { paymentDate: { ...(params.from ? { gte: new Date(`${params.from}T00:00:00.000Z`) } : {}), ...(params.to ? { lte: new Date(`${params.to}T00:00:00.000Z`) } : {}) } } : {}),
  };
  const [totalAgg, byMethod, payments] = await Promise.all([
    prisma.feePayment.aggregate({ where, _sum: { amount: true } }),
    prisma.feePayment.groupBy({ by: ["method"], where, _sum: { amount: true }, _count: { _all: true } }),
    prisma.feePayment.findMany({ where, select: { paymentDate: true, amount: true, allocations: { select: { amount: true, charge: { select: { categoryName: true } } } } } }),
  ]);

  const byCategoryMap = new Map<string, number>();
  const byDayMap = new Map<string, number>();
  for (const p of payments) {
    const day = p.paymentDate.toISOString().slice(0, 10);
    byDayMap.set(day, (byDayMap.get(day) ?? 0) + dec(p.amount));
    for (const a of p.allocations) byCategoryMap.set(a.charge.categoryName, (byCategoryMap.get(a.charge.categoryName) ?? 0) + dec(a.amount));
  }

  return {
    totalCollected: dec(totalAgg._sum.amount),
    byMethod: byMethod.map((m) => ({ method: METHOD_TO_UI[m.method] ?? "other", amount: dec(m._sum.amount), count: m._count._all })),
    byCategory: [...byCategoryMap.entries()].map(([categoryName, amount]) => ({ categoryName, amount: Math.round(amount * 100) / 100 })).sort((a, b) => b.amount - a.amount),
    byDay: [...byDayMap.entries()].map(([date, amount]) => ({ date, amount: Math.round(amount * 100) / 100 })).sort((a, b) => (a.date < b.date ? -1 : 1)),
  };
}

export async function getFeeOutstandingReport(scope: OrgScope): Promise<FeeOutstandingReportDto> {
  const sessionId = requireSession(scope);
  const charges = await prisma.feeCharge.findMany({
    where: { schoolId: scope.schoolId, academicSessionId: sessionId, student: { status: "ACTIVE" } },
    select: {
      amount: true, dueDate: true, adjustments: { select: { kind: true, computedAmount: true } }, allocations: { select: { amount: true } },
      student: { select: { enrollments: { where: { academicSessionId: sessionId, status: "ENROLLED" }, take: 1, select: { class: { select: { id: true, name: true } } } } } },
    },
  });
  let totalOutstanding = 0, totalOverdue = 0;
  const byClass = new Map<string, { className: string; outstanding: number; overdue: number }>();
  for (const c of charges) {
    const calc = computeCharge(c);
    if (calc.balance <= 0) continue;
    totalOutstanding += calc.balance;
    if (calc.status === "overdue") totalOverdue += calc.balance;
    const cls = c.student.enrollments[0]?.class;
    const key = cls?.id ?? "unassigned";
    const row = byClass.get(key) ?? { className: cls?.name ?? "Unassigned", outstanding: 0, overdue: 0 };
    row.outstanding += calc.balance;
    if (calc.status === "overdue") row.overdue += calc.balance;
    byClass.set(key, row);
  }
  return {
    totalOutstanding: Math.round(totalOutstanding * 100) / 100, totalOverdue: Math.round(totalOverdue * 100) / 100,
    byClass: [...byClass.entries()].map(([classId, r]) => ({ classId, className: r.className, outstanding: Math.round(r.outstanding * 100) / 100, overdue: Math.round(r.overdue * 100) / 100 })).sort((a, b) => b.outstanding - a.outstanding),
  };
}

export async function getFeeAdjustmentReport(scope: OrgScope, kind: "discount" | "scholarship" | "late_fee"): Promise<FeeAdjustmentReportDto> {
  requireSession(scope);
  const kindDb = kind === "discount" ? "DISCOUNT" : kind === "scholarship" ? "SCHOLARSHIP" : "LATE_FEE";
  const agg = await prisma.feeAdjustment.aggregate({ where: { schoolId: scope.schoolId, kind: kindDb as never }, _sum: { computedAmount: true }, _count: { _all: true } });
  return {
    totalDiscounts: kind === "discount" ? dec(agg._sum.computedAmount) : 0,
    totalScholarships: kind === "scholarship" ? dec(agg._sum.computedAmount) : 0,
    totalLateFees: kind === "late_fee" ? dec(agg._sum.computedAmount) : 0,
    count: agg._count._all,
  };
}

export async function getFeeRefundReport(scope: OrgScope): Promise<FeeRefundReportDto> {
  const agg = await prisma.feeRefund.aggregate({ where: { schoolId: scope.schoolId }, _sum: { amount: true }, _count: { _all: true } });
  return { totalRefunded: dec(agg._sum.amount), count: agg._count._all };
}

export async function getFeeReconciliationReport(scope: OrgScope): Promise<FeeReconciliationReportDto> {
  const grouped = await prisma.feePayment.groupBy({ by: ["reconciliationStatus"], where: { schoolId: scope.schoolId }, _count: { _all: true }, _sum: { amount: true } });
  const find = (s: string) => grouped.find((g) => g.reconciliationStatus === s);
  return {
    unreconciled: find("UNRECONCILED")?._count._all ?? 0,
    reconciled: find("RECONCILED")?._count._all ?? 0,
    mismatch: find("MISMATCH")?._count._all ?? 0,
    unreconciledAmount: dec(find("UNRECONCILED")?._sum.amount),
  };
}

export async function getFeeDashboard(scope: OrgScope): Promise<FeeDashboardDto> {
  const sessionId = requireSession(scope);
  const today = new Date();
  const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  const [collectedTodayAgg, collectedMonthAgg, charges] = await Promise.all([
    prisma.feePayment.aggregate({ where: { schoolId: scope.schoolId, paymentDate: { gte: todayStart } }, _sum: { amount: true } }),
    prisma.feePayment.aggregate({ where: { schoolId: scope.schoolId, paymentDate: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.feeCharge.findMany({ where: { schoolId: scope.schoolId, academicSessionId: sessionId, student: { status: "ACTIVE" } }, select: { amount: true, dueDate: true, adjustments: { select: { kind: true, computedAmount: true } }, allocations: { select: { amount: true } } } }),
  ]);

  let outstanding = 0, overdue = 0;
  for (const c of charges) {
    const calc = computeCharge(c);
    outstanding += calc.balance;
    if (calc.status === "overdue") overdue += calc.balance;
  }
  return { collectedToday: dec(collectedTodayAgg._sum.amount), outstanding: Math.round(outstanding * 100) / 100, overdue: Math.round(overdue * 100) / 100, collectedThisMonth: dec(collectedMonthAgg._sum.amount) };
}
