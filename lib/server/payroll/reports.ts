// Payroll reports + dashboard (Phase 9H) — every total here reads FINALIZED
// or PAID PayrollRun snapshots only; DRAFT/CALCULATED runs never contaminate
// an official total (a recalculation could still change them, so they are
// not yet a truthful historical figure).
import { prisma } from "@/lib/db/prisma";
import type { OrgScope } from "@/lib/server/api/scope";
import type { PayrollDashboardDto, PayrollEarningsDeductionsReportDto } from "@/lib/api/contracts";
import { dec } from "@/lib/server/fees/money";
import { listPayrollRuns } from "./runs";

const OFFICIAL_STATUSES = ["FINALIZED", "PAID"];

export async function getPayrollEarningsDeductionsReport(scope: OrgScope, params: { year?: number } = {}): Promise<PayrollEarningsDeductionsReportDto> {
  const runs = await prisma.payrollRun.findMany({
    where: { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}), status: { in: OFFICIAL_STATUSES as never }, ...(params.year ? { year: params.year } : {}) },
    select: { id: true, totalGross: true, totalDeductions: true, totalNet: true },
  });
  const runIds = runs.map((r) => r.id);
  const totalGross = Math.round(runs.reduce((s, r) => s + dec(r.totalGross), 0) * 100) / 100;
  const totalDeductions = Math.round(runs.reduce((s, r) => s + dec(r.totalDeductions), 0) * 100) / 100;
  const totalNet = Math.round(runs.reduce((s, r) => s + dec(r.totalNet), 0) * 100) / 100;

  const grouped = runIds.length
    ? await prisma.payrollRunItemComponent.groupBy({ by: ["componentId", "componentName", "type"], where: { payrollRunItem: { payrollRunId: { in: runIds } } }, _sum: { amount: true } })
    : [];
  const byComponent = grouped
    .map((g) => ({ componentId: g.componentId, name: g.componentName, type: g.type === "EARNING" ? ("earning" as const) : ("deduction" as const), amount: Math.round(dec(g._sum.amount) * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);

  return { totalGross, totalDeductions, totalNet, runCount: runs.length, byComponent };
}

export async function getPayrollDashboard(scope: OrgScope): Promise<PayrollDashboardDto> {
  const now = new Date();
  const [recentRuns, activeStructures, activeStaff, allAssignments] = await Promise.all([
    listPayrollRuns(scope),
    prisma.salaryStructure.count({ where: { schoolId: scope.schoolId, status: "ACTIVE" } }),
    prisma.staff.findMany({ where: { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}), status: "ACTIVE" }, select: { id: true } }),
    prisma.staffSalaryAssignment.findMany({ where: { schoolId: scope.schoolId, OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] }, select: { staffId: true } }),
  ]);
  const assignedIds = new Set(allAssignments.map((a) => a.staffId));
  const staffWithoutAssignment = activeStaff.filter((s) => !assignedIds.has(s.id)).length;

  const currentRun = recentRuns.find((r) => r.year === now.getUTCFullYear() && r.month === now.getUTCMonth() + 1) ?? null;
  const ytdRuns = recentRuns.filter((r) => r.year === now.getUTCFullYear() && (r.status === "finalized" || r.status === "paid"));

  return {
    currentPeriod: currentRun ? { year: currentRun.year, month: currentRun.month, period: currentRun.period } : null,
    currentRunStatus: currentRun?.status ?? null,
    currentRunGross: currentRun?.totalGross ?? 0,
    currentRunNet: currentRun?.totalNet ?? 0,
    currentRunStaffCount: currentRun?.staffCount ?? 0,
    yearToDateGross: Math.round(ytdRuns.reduce((s, r) => s + r.totalGross, 0) * 100) / 100,
    yearToDateNet: Math.round(ytdRuns.reduce((s, r) => s + r.totalNet, 0) * 100) / 100,
    activeStructures,
    staffWithoutAssignment,
    recentRuns: recentRuns.slice(0, 6),
  };
}
