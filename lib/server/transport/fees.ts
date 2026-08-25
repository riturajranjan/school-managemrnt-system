// Transport Fees — a thin read view over the real Phase 9F Fees engine,
// scoped to a "Transport" FeeCategory. Never a parallel collection engine:
// no TransportPayment/TransportReceipt, no second charge-calculation
// formula (computeCharge is reused verbatim, the exact same formula
// Collection/Dues/Reports use). Assigning a structure or recording a
// payment happens on the real Fees pages this view links out to.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import type { TransportFeesSummaryDto } from "@/lib/api/contracts";
import { computeCharge } from "@/lib/server/fees/balance";
import { listFeeCategories } from "@/lib/server/fees/categories";

const TRANSPORT_CATEGORY_NAME = "Transport";

function requireSession(scope: OrgScope): string {
  if (!scope.academicSessionId) throw new HttpError("INVALID_SESSION", "Select an academic session first");
  return scope.academicSessionId;
}

const chargeSelect = {
  id: true, studentId: true, categoryName: true, itemName: true, amount: true, dueDate: true,
  adjustments: { select: { kind: true, computedAmount: true } },
  allocations: { select: { amount: true } },
  student: { select: { firstName: true, lastName: true, admissionNumber: true } },
} satisfies Prisma.FeeChargeSelect;

export async function getTransportFeesSummary(scope: OrgScope): Promise<TransportFeesSummaryDto> {
  const sessionId = requireSession(scope);
  const categories = await listFeeCategories(scope);
  const category = categories.find((c) => c.name === TRANSPORT_CATEGORY_NAME);
  if (!category) {
    return { categoryExists: false, totalBilled: 0, totalCollected: 0, totalOutstanding: 0, overdueChargeCount: 0, rows: [] };
  }

  const charges = await prisma.feeCharge.findMany({
    where: { schoolId: scope.schoolId, academicSessionId: sessionId, categoryName: TRANSPORT_CATEGORY_NAME, ...(scope.branchId ? { student: { branchId: scope.branchId } } : {}) },
    orderBy: { dueDate: "asc" },
    select: chargeSelect,
  });

  let totalBilled = 0, totalCollected = 0, totalOutstanding = 0, overdueChargeCount = 0;
  const rows = charges.map((c) => {
    const calc = computeCharge(c);
    totalBilled += calc.netAmount;
    totalCollected += calc.paidAmount;
    totalOutstanding += calc.balance;
    if (calc.status === "overdue") overdueChargeCount += 1;
    return {
      studentId: c.studentId, studentName: `${c.student.firstName} ${c.student.lastName}`.trim(), admissionNumber: c.student.admissionNumber,
      itemName: c.itemName, dueDate: c.dueDate.toISOString().slice(0, 10), billedAmount: calc.netAmount, paidAmount: calc.paidAmount, balance: calc.balance, status: calc.status,
    };
  });

  return {
    categoryExists: true,
    totalBilled: Math.round(totalBilled * 100) / 100, totalCollected: Math.round(totalCollected * 100) / 100, totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    overdueChargeCount, rows,
  };
}
