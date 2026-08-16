// Phase 9H seed — real SalaryComponent rows (Basic/HRA/Transport), one real
// SalaryStructure built from them, real StaffSalaryAssignment rows against
// two of the real seeded teaching Staff (see seed-staff.ts), and one fully
// PAID PayrollRun (with its real Phase 9G accounting journal), so the demo
// has something real to walk through on the Payroll pages, reports and
// dashboard. Idempotent (code/name/period checks before every write) — uses
// the real service functions directly, never a second calculation engine.
import type { PrismaClient } from "../lib/generated/prisma/client";
import { createSalaryComponent } from "../lib/server/payroll/components";
import { createSalaryStructure } from "../lib/server/payroll/structures";
import { createStaffSalaryAssignment } from "../lib/server/payroll/assignments";
import { calculatePayrollRun, createPayrollRun, finalizePayrollRun } from "../lib/server/payroll/runs";
import { recordPayrollPayment } from "../lib/server/payroll/payments";
import type { OrgScope } from "../lib/server/api/scope";

type Ids = { tenantId: string; schoolId: string; branchId: string; academicSessionId: string };

const DEMO_PERIOD = { year: 2026, month: 6 };

export async function seedPayroll(prisma: PrismaClient, ids: Ids) {
  const { tenantId, schoolId, branchId, academicSessionId } = ids;

  const admin = await prisma.roleAssignment.findFirst({
    where: { role: { key: "SCHOOL_ADMIN" }, membership: { tenantId, status: "ACTIVE" } },
    select: { membership: { select: { userId: true } } },
  });
  const staffRows = await prisma.staff.findMany({ where: { schoolId, employeeCode: { in: ["TCH-001", "TCH-002"] } }, select: { id: true, employeeCode: true } });
  if (!admin || staffRows.length === 0) {
    console.log("  P9H:      skipped (no real SCHOOL_ADMIN or seeded Staff yet)");
    return;
  }
  const scope: OrgScope = { tenantId, schoolId, branchId, academicSessionId, actor: { id: admin.membership.userId, name: "School Admin" } };

  // 1) Components (idempotent on code).
  const componentDefs = [
    { code: "BASIC", name: "Basic Pay", type: "earning" as const, calcType: "fixed" as const },
    { code: "HRA", name: "House Rent Allowance", type: "earning" as const, calcType: "percentage" as const },
    { code: "TRANSPORT", name: "Transport Allowance", type: "earning" as const, calcType: "fixed" as const },
  ];
  const componentIds = new Map<string, string>();
  let componentsCreated = 0;
  for (const c of componentDefs) {
    const existing = await prisma.salaryComponent.findFirst({ where: { schoolId, code: c.code }, select: { id: true } });
    if (existing) { componentIds.set(c.code, existing.id); continue; }
    const created = await createSalaryComponent(scope, c);
    componentIds.set(c.code, created.id);
    componentsCreated++;
  }

  // 2) One reusable structure (idempotent on name).
  const STRUCTURE_NAME = "Standard Teaching Staff";
  let structureId = (await prisma.salaryStructure.findFirst({ where: { schoolId, name: STRUCTURE_NAME }, select: { id: true } }))?.id ?? null;
  if (!structureId) {
    const created = await createSalaryStructure(scope, {
      name: STRUCTURE_NAME,
      components: [
        { componentId: componentIds.get("BASIC")!, amount: 40000 },
        { componentId: componentIds.get("HRA")!, percent: 40, percentOfComponentId: componentIds.get("BASIC")! },
        { componentId: componentIds.get("TRANSPORT")!, amount: 2000 },
      ],
    });
    structureId = created.id;
  }

  // 3) Assign the structure to the two demo teaching staff (idempotent — skip if already assigned).
  let assigned = 0;
  for (const staff of staffRows) {
    const existing = await prisma.staffSalaryAssignment.findFirst({ where: { schoolId, staffId: staff.id }, select: { id: true } });
    if (existing) continue;
    await createStaffSalaryAssignment(scope, { staffId: staff.id, salaryStructureId: structureId, effectiveFrom: "2026-04-01" });
    assigned++;
  }

  // 4) One fully paid demo run for a fixed period (idempotent — skip the whole block if it already exists).
  let ranDemoPayroll = false;
  const existingRun = await prisma.payrollRun.findFirst({ where: { schoolId, branchId, year: DEMO_PERIOD.year, month: DEMO_PERIOD.month }, select: { id: true } });
  if (!existingRun) {
    const run = await createPayrollRun(scope, DEMO_PERIOD);
    await calculatePayrollRun(scope, run.id);
    const finalized = await finalizePayrollRun(scope, run.id);
    if (finalized.items.length > 0) {
      await recordPayrollPayment(scope, run.id, { paymentDate: "2026-06-30", method: "bank_transfer", reference: "SEED-DEMO" });
      ranDemoPayroll = true;
    }
  }

  console.log(`  P9H:      components(+${componentsCreated}) structure(${STRUCTURE_NAME}) assignments(+${assigned}) demoPayrollRun(${ranDemoPayroll ? "paid" : "skipped/exists"})`);
}
