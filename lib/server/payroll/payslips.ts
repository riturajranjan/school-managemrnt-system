// Payslips (Phase 9H) — pure presentation over a frozen PayrollRunItem
// snapshot; never recomputed from live Staff/SalaryStructure data. Two
// access paths: a broad payroll.view holder can view ANY payslip in scope;
// a Staff user with no such permission may ONLY view their OWN payslip,
// resolved via the real Staff.userId link (getCurrentStaffProfile) — never
// a staffId/employeeId trusted from the browser.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import type { PayrollRunStatusDto, PayslipDto } from "@/lib/api/contracts";
import { dec } from "@/lib/server/fees/money";
import { getCurrentStaffProfile } from "@/lib/server/staff/service";
import { isBroadPayrollManager } from "./access";

const STATUS_TO_UI: Record<string, PayrollRunStatusDto> = { DRAFT: "draft", CALCULATED: "calculated", FINALIZED: "finalized", PAID: "paid" };
const period = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

const select = {
  id: true, createdAt: true, employeeCode: true, staffName: true, grossEarnings: true, totalDeductions: true, netPay: true,
  presentDays: true, absentDays: true, lateDays: true, halfDays: true, onLeaveDays: true, notMarkedDays: true, paidLeaveDays: true, unpaidLeaveDays: true,
  components: { select: { componentName: true, type: true, amount: true } },
  payrollRun: { select: { id: true, year: true, month: true, status: true, schoolId: true, paidAt: true } },
} as const;

async function requireOwnPayslipOrManager(scope: OrgScope, itemId: string) {
  const item = await prisma.payrollRunItem.findFirst({ where: { id: itemId, payrollRun: { schoolId: scope.schoolId } }, select: { staffId: true } });
  if (!item) throw new HttpError("PAYROLL_RUN_ITEM_NOT_FOUND", "Payslip not found");
  if (await isBroadPayrollManager(scope)) return;
  const own = await getCurrentStaffProfile(scope);
  if (!own || own.id !== item.staffId) throw new HttpError("PAYROLL_RUN_ITEM_NOT_FOUND", "Payslip not found");
}

export async function getPayslip(scope: OrgScope, itemId: string): Promise<PayslipDto> {
  await requireOwnPayslipOrManager(scope, itemId);
  const item = await prisma.payrollRunItem.findUniqueOrThrow({ where: { id: itemId }, select });
  const school = await prisma.school.findUniqueOrThrow({ where: { id: item.payrollRun.schoolId }, select: { name: true } });
  return {
    id: item.id, payrollRunId: item.payrollRun.id, period: period(item.payrollRun.year, item.payrollRun.month), runStatus: STATUS_TO_UI[item.payrollRun.status],
    school: school.name, employeeCode: item.employeeCode, staffName: item.staffName,
    earnings: item.components.filter((c) => c.type === "EARNING").map((c) => ({ label: c.componentName, amount: dec(c.amount) })),
    deductions: item.components.filter((c) => c.type === "DEDUCTION").map((c) => ({ label: c.componentName, amount: dec(c.amount) })),
    grossEarnings: dec(item.grossEarnings), totalDeductions: dec(item.totalDeductions), netPay: dec(item.netPay),
    attendance: { present: item.presentDays, absent: item.absentDays, late: item.lateDays, halfDay: item.halfDays, onLeave: item.onLeaveDays, notMarked: item.notMarkedDays, paidLeave: item.paidLeaveDays, unpaidLeave: item.unpaidLeaveDays },
    paymentStatus: item.payrollRun.status === "PAID" ? "paid" : "unpaid", paidOn: item.payrollRun.paidAt?.toISOString().slice(0, 10) ?? null,
    generatedAt: item.createdAt.toISOString(),
  };
}

/** Every payslip visible to the current actor — broad managers see all
 * FINALIZED/PAID payslips in scope; a Staff user with no payroll.manage sees
 * only their own. */
export async function listPayslips(scope: OrgScope, params: { period?: string } = {}): Promise<{ id: string; period: string; employeeCode: string; staffName: string; netPay: number; runStatus: PayrollRunStatusDto }[]> {
  const isManager = await isBroadPayrollManager(scope);
  const own = isManager ? null : await getCurrentStaffProfile(scope);
  if (!isManager && !own) return [];

  const rows = await prisma.payrollRunItem.findMany({
    where: {
      payrollRun: { schoolId: scope.schoolId, status: { in: ["FINALIZED", "PAID"] } },
      ...(isManager ? {} : { staffId: own!.id }),
    },
    orderBy: [{ payrollRun: { year: "desc" } }, { payrollRun: { month: "desc" } }, { staffName: "asc" }],
    select: { id: true, employeeCode: true, staffName: true, netPay: true, payrollRun: { select: { year: true, month: true, status: true } } },
  });
  const filtered = params.period ? rows.filter((r) => period(r.payrollRun.year, r.payrollRun.month) === params.period) : rows;
  return filtered.map((r) => ({ id: r.id, period: period(r.payrollRun.year, r.payrollRun.month), employeeCode: r.employeeCode, staffName: r.staffName, netPay: dec(r.netPay), runStatus: STATUS_TO_UI[r.payrollRun.status] }));
}
