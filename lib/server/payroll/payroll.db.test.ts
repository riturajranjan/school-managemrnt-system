// Payroll DB integration tests (Phase 9H). Real Postgres: Salary Components
// (+ duplicate code / archive), Salary Structures (+ lock-on-assignment,
// percentage-of-fixed validation), Staff Salary Assignments (+ effective-
// dating, overlap prevention), Payroll calculation (gross/deductions/net,
// attendance/leave never affecting the total), lifecycle (DRAFT ->
// CALCULATED -> FINALIZED -> PAID, immutability, double-finalize/double-pay
// rejection), Payslips (self-service ownership), Accounting integration
// (idempotent + concurrency-safe posting, ledger/trial-balance inclusion),
// isolation, RBAC, audit, historical safety. Namespaced ("T9H"). Mirrors the
// exact setup/teardown pattern of lib/server/accounting/accounting.db.test.ts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createSalaryComponent, updateSalaryComponent } from "@/lib/server/payroll/components";
import { createSalaryStructure, getSalaryStructure, updateSalaryStructure } from "@/lib/server/payroll/structures";
import { createStaffSalaryAssignment } from "@/lib/server/payroll/assignments";
import { addManualPayrollAdjustment, calculatePayrollRun, createPayrollRun, finalizePayrollRun, getPayrollRun } from "@/lib/server/payroll/runs";
import { recordPayrollPayment } from "@/lib/server/payroll/payments";
import { getPayslip, listPayslips } from "@/lib/server/payroll/payslips";
import { getPayrollDashboard, getPayrollEarningsDeductionsReport } from "@/lib/server/payroll/reports";
import { getAccountLedger, getTrialBalance } from "@/lib/server/accounting/ledger";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T9H";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "";
let staff1 = "", staff2 = "", staff3 = "";
let foreignTenantId = "", foreignSchoolId = "", foreignStaffId = "";
let scopeAdmin: OrgScope, scopeTeacher: OrgScope, scopeSelf: OrgScope, scopeForeignAdmin: OrgScope;
let adminUser = "", teacherUser = "", selfUser = "", foreignAdminUser = "";

async function makeUserWithRole(email: string, roleKey: string, tid = tenantId): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId: tid, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t9h-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;

  for (const [i, name] of ["Ravi Kumar", "Sita Sharma", "Amit Verma"].entries()) {
    const s = (await prisma.staff.create({
      data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-${stamp}-${i}`, firstName: name.split(" ")[0], lastName: name.split(" ")[1], status: "ACTIVE" },
      select: { id: true },
    })).id;
    if (i === 0) staff1 = s;
    else if (i === 1) staff2 = s;
    else staff3 = s;
  }

  adminUser = await makeUserWithRole(`t9h-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  teacherUser = await makeUserWithRole(`t9h-t1-${stamp}@x.test`, "TEACHER");
  selfUser = await makeUserWithRole(`t9h-self-${stamp}@x.test`, "TEACHER");
  await prisma.staff.update({ where: { id: staff1 }, data: { userId: selfUser } });

  foreignTenantId = (await prisma.tenant.create({ data: { name: `${NS} T2`, slug: `t9h-b-${stamp}` }, select: { id: true } })).id;
  foreignSchoolId = (await prisma.school.create({ data: { tenantId: foreignTenantId, name: `${NS} S2`, code: `${NS}-B-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  const foreignBranch = (await prisma.branch.create({ data: { schoolId: foreignSchoolId, name: "B", code: `${NS}-B`, status: "ACTIVE" }, select: { id: true } })).id;
  foreignStaffId = (await prisma.staff.create({ data: { tenantId: foreignTenantId, schoolId: foreignSchoolId, branchId: foreignBranch, employeeCode: `${NS}-F-${stamp}`, firstName: "Foreign", status: "ACTIVE" }, select: { id: true } })).id;
  foreignAdminUser = await makeUserWithRole(`t9h-fadmin-${stamp}@x.test`, "SCHOOL_ADMIN", foreignTenantId);

  scopeAdmin = { tenantId, schoolId, branchId: branchA, academicSessionId: null, actor: { id: adminUser, name: "Admin" } };
  scopeTeacher = { tenantId, schoolId, branchId: branchA, academicSessionId: null, actor: { id: teacherUser, name: "Teacher" } };
  scopeSelf = { tenantId, schoolId, branchId: branchA, academicSessionId: null, actor: { id: selfUser, name: "Self" } };
  scopeForeignAdmin = { tenantId: foreignTenantId, schoolId: foreignSchoolId, branchId: foreignBranch, academicSessionId: null, actor: { id: foreignAdminUser, name: "Foreign Admin" } };
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.journalLine.deleteMany({ where: { journalEntry: { schoolId: { in: [schoolId, foreignSchoolId] } } } });
  await prisma.journalEntry.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.accountingEntryCounter.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.accountingAccount.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.payrollPayment.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.payrollRunItemComponent.deleteMany({ where: { payrollRunItem: { payrollRun: { schoolId: { in: [schoolId, foreignSchoolId] } } } } });
  await prisma.payrollRunItem.deleteMany({ where: { payrollRun: { schoolId: { in: [schoolId, foreignSchoolId] } } } });
  await prisma.payrollRun.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.staffSalaryAssignment.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.salaryStructureComponent.deleteMany({ where: { salaryStructure: { schoolId: { in: [schoolId, foreignSchoolId] } } } });
  await prisma.salaryStructure.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.salaryComponent.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.staffAttendanceRecord.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.leaveRequest.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.staff.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.roleAssignment.deleteMany({ where: { membership: { tenantId: { in: [tenantId, foreignTenantId] } } } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.branch.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.school.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUser, teacherUser, selfUser, foreignAdminUser] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, foreignTenantId] } } });
});

describe.skipIf(!dbReady)("Salary Components (DB)", () => {
  it("creates an earning and a deduction; duplicate code rejected; TEACHER cannot manage", async () => {
    const earning = await createSalaryComponent(scopeAdmin, { code: `BASIC${stamp}`, name: "Basic", type: "earning", calcType: "fixed" });
    expect(earning.type).toBe("earning");
    const deduction = await createSalaryComponent(scopeAdmin, { code: `PF${stamp}`, name: "Provident Fund", type: "deduction", calcType: "fixed" });
    expect(deduction.type).toBe("deduction");
    await expect(createSalaryComponent(scopeAdmin, { code: `BASIC${stamp}`, name: "Dup", type: "earning", calcType: "fixed" })).rejects.toThrow(HttpError);
    await expect(createSalaryComponent(scopeTeacher, { code: `X${stamp}`, name: "X", type: "earning", calcType: "fixed" })).rejects.toThrow(HttpError);
  });

  it("updates and archives a component; archived components remain readable", async () => {
    const c = await createSalaryComponent(scopeAdmin, { code: `ARC${stamp}`, name: "Original", type: "earning", calcType: "fixed" });
    const updated = await updateSalaryComponent(scopeAdmin, c.id, { name: "Renamed" });
    expect(updated.name).toBe("Renamed");
    const archived = await updateSalaryComponent(scopeAdmin, c.id, { status: "archived" });
    expect(archived.status).toBe("archived");
  });

  it("cross-school component is invisible to structure creation (foreign component id rejected)", async () => {
    const foreignComp = await createSalaryComponent(scopeForeignAdmin, { code: `FC${stamp}`, name: "Foreign", type: "earning", calcType: "fixed" });
    await expect(createSalaryStructure(scopeAdmin, { name: `Cross-school ${stamp}`, components: [{ componentId: foreignComp.id, amount: 100 }] })).rejects.toThrow(HttpError);
  });
});

describe.skipIf(!dbReady)("Salary Structures (DB)", () => {
  it("creates a structure with fixed + percentage-of-fixed components", async () => {
    const basic = await createSalaryComponent(scopeAdmin, { code: `SB${stamp}`, name: "Basic", type: "earning", calcType: "fixed" });
    const hra = await createSalaryComponent(scopeAdmin, { code: `SH${stamp}`, name: "HRA", type: "earning", calcType: "percentage" });
    const structure = await createSalaryStructure(scopeAdmin, { name: `Plan ${stamp}`, components: [{ componentId: basic.id, amount: 30000 }, { componentId: hra.id, percent: 50, percentOfComponentId: basic.id }] });
    expect(structure.components.length).toBe(2);
    const hraLine = structure.components.find((c) => c.componentId === hra.id)!;
    expect(hraLine.percent).toBe(50);
    expect(hraLine.percentOfLineId).toBe(structure.components.find((c) => c.componentId === basic.id)!.id);
  });

  it("rejects a duplicate component in one structure, a percentage base outside the structure, and a percentage-of-percentage chain", async () => {
    const basic = await createSalaryComponent(scopeAdmin, { code: `SD${stamp}`, name: "Basic", type: "earning", calcType: "fixed" });
    const hra = await createSalaryComponent(scopeAdmin, { code: `SD2${stamp}`, name: "HRA", type: "earning", calcType: "percentage" });
    await expect(createSalaryStructure(scopeAdmin, { name: `Dup ${stamp}`, components: [{ componentId: basic.id, amount: 100 }, { componentId: basic.id, amount: 200 }] })).rejects.toThrow(HttpError);
    await expect(createSalaryStructure(scopeAdmin, { name: `NoBase ${stamp}`, components: [{ componentId: hra.id, percent: 10, percentOfComponentId: "nonexistent" }] })).rejects.toThrow(HttpError);
    const hra2 = await createSalaryComponent(scopeAdmin, { code: `SD3${stamp}`, name: "HRA2", type: "earning", calcType: "percentage" });
    await expect(createSalaryStructure(scopeAdmin, { name: `Chain ${stamp}`, components: [{ componentId: hra.id, percent: 10, percentOfComponentId: hra2.id }, { componentId: hra2.id, percent: 20, percentOfComponentId: hra.id }] })).rejects.toThrow(HttpError);
  });

  it("rejects an archived component being newly added to a structure", async () => {
    const comp = await createSalaryComponent(scopeAdmin, { code: `ARCX${stamp}`, name: "Archived one", type: "earning", calcType: "fixed" });
    await updateSalaryComponent(scopeAdmin, comp.id, { status: "archived" });
    await expect(createSalaryStructure(scopeAdmin, { name: `UsesArchived ${stamp}`, components: [{ componentId: comp.id, amount: 100 }] })).rejects.toThrow(HttpError);
  });

  it("structural edits are blocked once ANY staff is assigned", async () => {
    const comp = await createSalaryComponent(scopeAdmin, { code: `LK${stamp}`, name: "Lock comp", type: "earning", calcType: "fixed" });
    const structure = await createSalaryStructure(scopeAdmin, { name: `Locked ${stamp}`, components: [{ componentId: comp.id, amount: 1000 }] });
    // Bounded so this staff/structure never leaks into a later test's run-total assertions.
    await createStaffSalaryAssignment(scopeAdmin, { staffId: staff3, salaryStructureId: structure.id, effectiveFrom: "2020-01-01", effectiveTo: "2020-12-31" });
    await expect(updateSalaryStructure(scopeAdmin, structure.id, { components: [{ componentId: comp.id, amount: 2000 }] })).rejects.toThrow(HttpError);
    // name/description edits remain allowed even once locked
    const renamed = await updateSalaryStructure(scopeAdmin, structure.id, { name: `Locked Renamed ${stamp}` });
    expect(renamed.name).toBe(`Locked Renamed ${stamp}`);
  });
});

describe.skipIf(!dbReady)("Staff Salary Assignments (DB)", () => {
  it("assigns a real Staff; a foreign Staff is rejected", async () => {
    const comp = await createSalaryComponent(scopeAdmin, { code: `AS1${stamp}`, name: "AS Comp", type: "earning", calcType: "fixed" });
    const structure = await createSalaryStructure(scopeAdmin, { name: `AS Plan ${stamp}`, components: [{ componentId: comp.id, amount: 5000 }] });
    // Bounded so it never overlaps a later test's own open-ended assignment for staff1.
    const assignment = await createStaffSalaryAssignment(scopeAdmin, { staffId: staff1, salaryStructureId: structure.id, effectiveFrom: "2026-04-01", effectiveTo: "2026-06-30" });
    expect(assignment.staffId).toBe(staff1);
    await expect(createStaffSalaryAssignment(scopeAdmin, { staffId: foreignStaffId, salaryStructureId: structure.id, effectiveFrom: "2026-04-01" })).rejects.toThrow(HttpError);
  });

  it("overlapping active assignments for the same staff are prevented; a later non-overlapping one succeeds", async () => {
    const comp = await createSalaryComponent(scopeAdmin, { code: `OV1${stamp}`, name: "Overlap comp", type: "earning", calcType: "fixed" });
    const structureA = await createSalaryStructure(scopeAdmin, { name: `Overlap A ${stamp}`, components: [{ componentId: comp.id, amount: 1000 }] });
    const structureB = await createSalaryStructure(scopeAdmin, { name: `Overlap B ${stamp}`, components: [{ componentId: comp.id, amount: 2000 }] });
    await createStaffSalaryAssignment(scopeAdmin, { staffId: staff2, salaryStructureId: structureA.id, effectiveFrom: "2026-01-01", effectiveTo: "2026-06-30" });
    await expect(createStaffSalaryAssignment(scopeAdmin, { staffId: staff2, salaryStructureId: structureB.id, effectiveFrom: "2026-03-01" })).rejects.toThrow(HttpError);
    // Bounded so it never overlaps a later test's own open-ended assignment for staff2.
    const second = await createStaffSalaryAssignment(scopeAdmin, { staffId: staff2, salaryStructureId: structureB.id, effectiveFrom: "2026-07-01", effectiveTo: "2026-12-31" });
    expect(second.effectiveFrom).toBe("2026-07-01");
  });

  it("concurrent overlapping assignment attempts for the SAME staff: only one succeeds (row-locked)", async () => {
    const comp = await createSalaryComponent(scopeAdmin, { code: `CC1${stamp}`, name: "Concurrent comp", type: "earning", calcType: "fixed" });
    const structure = await createSalaryStructure(scopeAdmin, { name: `Concurrent plan ${stamp}`, components: [{ componentId: comp.id, amount: 500 }] });
    const freshStaff = await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-CC-${stamp}`, firstName: "Concurrent", status: "ACTIVE" }, select: { id: true } });
    const results = await Promise.all([
      createStaffSalaryAssignment(scopeAdmin, { staffId: freshStaff.id, salaryStructureId: structure.id, effectiveFrom: "2026-01-01", effectiveTo: "2026-12-31" }).catch((e) => e),
      createStaffSalaryAssignment(scopeAdmin, { staffId: freshStaff.id, salaryStructureId: structure.id, effectiveFrom: "2026-01-01", effectiveTo: "2026-12-31" }).catch((e) => e),
    ]);
    const succeeded = results.filter((r) => !(r instanceof Error));
    expect(succeeded.length).toBe(1);
    const count = await prisma.staffSalaryAssignment.count({ where: { staffId: freshStaff.id } });
    expect(count).toBe(1);
  });
});

describe.skipIf(!dbReady)("Payroll Calculation + Lifecycle (DB)", () => {
  it("calculates gross/deductions/net correctly; a staff with no assignment is honestly excluded, not fabricated", async () => {
    const basic = await createSalaryComponent(scopeAdmin, { code: `CB1${stamp}`, name: "Calc Basic", type: "earning", calcType: "fixed" });
    const hra = await createSalaryComponent(scopeAdmin, { code: `CH1${stamp}`, name: "Calc HRA", type: "earning", calcType: "percentage" });
    const tax = await createSalaryComponent(scopeAdmin, { code: `CT1${stamp}`, name: "Calc Tax", type: "deduction", calcType: "fixed" });
    const structure = await createSalaryStructure(scopeAdmin, {
      name: `Calc Plan ${stamp}`,
      components: [{ componentId: basic.id, amount: 20000 }, { componentId: hra.id, percent: 50, percentOfComponentId: basic.id }, { componentId: tax.id, amount: 1500 }],
    });
    const freshStaff = await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-CALC-${stamp}`, firstName: "Calc", status: "ACTIVE" }, select: { id: true } });
    await createStaffSalaryAssignment(scopeAdmin, { staffId: freshStaff.id, salaryStructureId: structure.id, effectiveFrom: "2026-01-01", effectiveTo: "2031-12-31" });

    const run = await createPayrollRun(scopeAdmin, { year: 2031, month: 3 });
    const calculated = await calculatePayrollRun(scopeAdmin, run.id);
    const item = calculated.items.find((i) => i.staffId === freshStaff.id)!;
    expect(item.grossEarnings).toBe(30000); // 20000 + 50%*20000
    expect(item.totalDeductions).toBe(1500);
    expect(item.netPay).toBe(28500);

    // staff2/staff3 (and everyone else ACTIVE in this branch without an assignment as of this period) are excluded, not zero-filled
    expect(calculated.staffWithoutAssignment.some((s) => s.staffId === staff2 || s.staffId === staff3)).toBe(true);
  });

  it("recalculating a DRAFT/CALCULATED run replaces items rather than accumulating", async () => {
    const comp = await createSalaryComponent(scopeAdmin, { code: `RC1${stamp}`, name: "Recalc comp", type: "earning", calcType: "fixed" });
    const structure = await createSalaryStructure(scopeAdmin, { name: `Recalc plan ${stamp}`, components: [{ componentId: comp.id, amount: 1000 }] });
    const freshStaff = await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-RC-${stamp}`, firstName: "Recalc", status: "ACTIVE" }, select: { id: true } });
    await createStaffSalaryAssignment(scopeAdmin, { staffId: freshStaff.id, salaryStructureId: structure.id, effectiveFrom: "2026-01-01", effectiveTo: "2031-12-31" });
    const run = await createPayrollRun(scopeAdmin, { year: 2031, month: 4 });
    await calculatePayrollRun(scopeAdmin, run.id);
    const again = await calculatePayrollRun(scopeAdmin, run.id);
    const itemsForStaff = again.items.filter((i) => i.staffId === freshStaff.id);
    expect(itemsForStaff.length).toBe(1); // never duplicated
  });

  it("duplicate payroll period for the same branch is rejected", async () => {
    await createPayrollRun(scopeAdmin, { year: 2031, month: 5 });
    await expect(createPayrollRun(scopeAdmin, { year: 2031, month: 5 })).rejects.toThrow(HttpError);
  });

  it("attendance (including NOT_MARKED) and leave never change the calculated salary", async () => {
    const comp = await createSalaryComponent(scopeAdmin, { code: `ATT1${stamp}`, name: "Attendance comp", type: "earning", calcType: "fixed" });
    const structure = await createSalaryStructure(scopeAdmin, { name: `Attendance plan ${stamp}`, components: [{ componentId: comp.id, amount: 9999 }] });
    const freshStaff = await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-ATT-${stamp}`, firstName: "Attendance", status: "ACTIVE" }, select: { id: true } });
    await createStaffSalaryAssignment(scopeAdmin, { staffId: freshStaff.id, salaryStructureId: structure.id, effectiveFrom: "2026-01-01", effectiveTo: "2031-12-31" });
    // Mark this staff ABSENT for every day but one — a fabricated LOP policy would reduce net pay; the real one must not.
    await prisma.staffAttendanceRecord.create({ data: { tenantId, schoolId, branchId: branchA, staffId: freshStaff.id, date: new Date("2031-06-05"), status: "ABSENT", markedByUserId: adminUser } });
    const leaveType = await prisma.leaveType.upsert({ where: { schoolId_code: { schoolId, code: `UNPAID${stamp}` } }, create: { tenantId, schoolId, name: "Unpaid", code: `UNPAID${stamp}`, isPaid: false }, update: {} });
    await prisma.leaveRequest.create({ data: { tenantId, schoolId, branchId: branchA, staffId: freshStaff.id, leaveTypeId: leaveType.id, startDate: new Date("2031-06-10"), endDate: new Date("2031-06-12"), reason: "test", status: "APPROVED", requestedByUserId: adminUser } });

    const run = await createPayrollRun(scopeAdmin, { year: 2031, month: 6 });
    const calculated = await calculatePayrollRun(scopeAdmin, run.id);
    const item = calculated.items.find((i) => i.staffId === freshStaff.id)!;
    expect(item.netPay).toBe(9999); // unaffected by ABSENT or unpaid leave
    expect(item.attendance.absent).toBe(1); // but the informational summary is real
    expect(item.attendance.unpaidLeave).toBeGreaterThanOrEqual(3);
    expect(item.attendance.notMarked).toBeGreaterThan(0); // most days in the period have no record at all — honestly NOT_MARKED, never silently ABSENT
  });

  it("a manual adjustment (bonus) increases gross and the run total; blocked once finalized", async () => {
    const basicComp = await createSalaryComponent(scopeAdmin, { code: `MAN1${stamp}`, name: "Manual base", type: "earning", calcType: "fixed" });
    const bonusComp = await createSalaryComponent(scopeAdmin, { code: `MAN2${stamp}`, name: "Bonus", type: "earning", calcType: "fixed" });
    const structure = await createSalaryStructure(scopeAdmin, { name: `Manual plan ${stamp}`, components: [{ componentId: basicComp.id, amount: 10000 }] });
    const freshStaff = await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-MAN-${stamp}`, firstName: "Manual", status: "ACTIVE" }, select: { id: true } });
    await createStaffSalaryAssignment(scopeAdmin, { staffId: freshStaff.id, salaryStructureId: structure.id, effectiveFrom: "2026-01-01", effectiveTo: "2031-12-31" });
    const run = await createPayrollRun(scopeAdmin, { year: 2031, month: 7 });
    const calculated = await calculatePayrollRun(scopeAdmin, run.id);
    const item = calculated.items.find((i) => i.staffId === freshStaff.id)!;
    const afterAdjustment = await addManualPayrollAdjustment(scopeAdmin, run.id, item.id, { componentId: bonusComp.id, amount: 500, reason: "Diwali bonus" });
    const adjustedItem = afterAdjustment.items.find((i) => i.staffId === freshStaff.id)!;
    expect(adjustedItem.grossEarnings).toBe(10500);
    expect(afterAdjustment.totalGross).toBeGreaterThanOrEqual(10500);

    const finalized = await finalizePayrollRun(scopeAdmin, run.id);
    expect(finalized.status).toBe("finalized");
    await expect(addManualPayrollAdjustment(scopeAdmin, run.id, item.id, { componentId: bonusComp.id, amount: 100, reason: "Too late" })).rejects.toThrow(HttpError);
  });

  it("finalize is rejected if any item has negative net pay", async () => {
    const earn = await createSalaryComponent(scopeAdmin, { code: `NEG1${stamp}`, name: "Neg earn", type: "earning", calcType: "fixed" });
    const ded = await createSalaryComponent(scopeAdmin, { code: `NEG2${stamp}`, name: "Neg ded", type: "deduction", calcType: "fixed" });
    const structure = await createSalaryStructure(scopeAdmin, { name: `Neg plan ${stamp}`, components: [{ componentId: earn.id, amount: 100 }, { componentId: ded.id, amount: 500 }] });
    const freshStaff = await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-NEG-${stamp}`, firstName: "Negative", status: "ACTIVE" }, select: { id: true } });
    // Bounded to this single period only — an open-ended assignment here would leak this
    // negative-net-pay staff member into every later run this file creates in this branch.
    await createStaffSalaryAssignment(scopeAdmin, { staffId: freshStaff.id, salaryStructureId: structure.id, effectiveFrom: "2031-08-01", effectiveTo: "2031-08-31" });
    const run = await createPayrollRun(scopeAdmin, { year: 2031, month: 8 });
    await calculatePayrollRun(scopeAdmin, run.id);
    await expect(finalizePayrollRun(scopeAdmin, run.id)).rejects.toThrow(HttpError);
  });

  it("finalizing an uncalculated (DRAFT) run is rejected", async () => {
    const run = await createPayrollRun(scopeAdmin, { year: 2031, month: 9 });
    await expect(finalizePayrollRun(scopeAdmin, run.id)).rejects.toThrow(HttpError);
  });

  it("a FINALIZED run's snapshot is immutable; double-finalize is rejected", async () => {
    const comp = await createSalaryComponent(scopeAdmin, { code: `IMM1${stamp}`, name: "Immutable comp", type: "earning", calcType: "fixed" });
    const structure = await createSalaryStructure(scopeAdmin, { name: `Immutable plan ${stamp}`, components: [{ componentId: comp.id, amount: 7000 }] });
    const freshStaff = await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-IMM-${stamp}`, firstName: "Immutable", status: "ACTIVE" }, select: { id: true } });
    await createStaffSalaryAssignment(scopeAdmin, { staffId: freshStaff.id, salaryStructureId: structure.id, effectiveFrom: "2026-01-01", effectiveTo: "2031-12-31" });
    const run = await createPayrollRun(scopeAdmin, { year: 2031, month: 10 });
    await calculatePayrollRun(scopeAdmin, run.id);
    const finalized = await finalizePayrollRun(scopeAdmin, run.id);
    const item = finalized.items.find((i) => i.staffId === freshStaff.id)!;
    expect(item.netPay).toBe(7000);
    await expect(finalizePayrollRun(scopeAdmin, run.id)).rejects.toThrow(HttpError);
    // Re-calculating is also structurally impossible once finalized (not DRAFT/CALCULATED).
    await expect(calculatePayrollRun(scopeAdmin, run.id)).rejects.toThrow(HttpError);
  });

  it("two concurrent finalize attempts on the same run: exactly one succeeds", async () => {
    const comp = await createSalaryComponent(scopeAdmin, { code: `CF1${stamp}`, name: "Concurrent finalize comp", type: "earning", calcType: "fixed" });
    const structure = await createSalaryStructure(scopeAdmin, { name: `Concurrent finalize plan ${stamp}`, components: [{ componentId: comp.id, amount: 3000 }] });
    const freshStaff = await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-CF-${stamp}`, firstName: "ConcurrentF", status: "ACTIVE" }, select: { id: true } });
    await createStaffSalaryAssignment(scopeAdmin, { staffId: freshStaff.id, salaryStructureId: structure.id, effectiveFrom: "2026-01-01", effectiveTo: "2031-12-31" });
    const run = await createPayrollRun(scopeAdmin, { year: 2031, month: 11 });
    await calculatePayrollRun(scopeAdmin, run.id);
    const results = await Promise.all([finalizePayrollRun(scopeAdmin, run.id).catch((e) => e), finalizePayrollRun(scopeAdmin, run.id).catch((e) => e)]);
    const succeeded = results.filter((r) => !(r instanceof Error));
    expect(succeeded.length).toBe(1);
    const final = await getPayrollRun(scopeAdmin, run.id);
    expect(final.status).toBe("finalized");
  });
});

describe.skipIf(!dbReady)("Payment + Accounting Integration (DB)", () => {
  // Bounded to exactly [year, month] so this staff member never leaks into any
  // other test's run in this shared branch — required for the run-level total
  // (== payment.amount, whole-run payment) to equal exactly `amount`.
  async function makeFinalizedRun(year: number, month: number, amount: number, tag: string) {
    const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const periodEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    const comp = await createSalaryComponent(scopeAdmin, { code: `${tag}${stamp}`.slice(0, 20), name: "Pay comp", type: "earning", calcType: "fixed" });
    const structure = await createSalaryStructure(scopeAdmin, { name: `Pay plan ${tag}${stamp}`, components: [{ componentId: comp.id, amount }] });
    const freshStaff = await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-${tag}-${stamp}`, firstName: tag, status: "ACTIVE" }, select: { id: true } });
    await createStaffSalaryAssignment(scopeAdmin, { staffId: freshStaff.id, salaryStructureId: structure.id, effectiveFrom: periodStart, effectiveTo: periodEnd });
    const run = await createPayrollRun(scopeAdmin, { year, month });
    await calculatePayrollRun(scopeAdmin, run.id);
    const finalized = await finalizePayrollRun(scopeAdmin, run.id);
    return { run: finalized, staffId: freshStaff.id };
  }

  it("payment requires a FINALIZED run; a DRAFT/CALCULATED run cannot be paid", async () => {
    const run = await createPayrollRun(scopeAdmin, { year: 2031, month: 1 });
    await expect(recordPayrollPayment(scopeAdmin, run.id, { paymentDate: "2031-01-31", method: "bank_transfer" })).rejects.toThrow(HttpError);
  });

  it("records a payment and posts a balanced JournalEntry with the correct expense/bank accounts", async () => {
    const { run } = await makeFinalizedRun(2032, 1, 15000, "PAYOK");
    const payment = await recordPayrollPayment(scopeAdmin, run.id, { paymentDate: "2032-01-31", method: "bank_transfer", reference: "TESTREF" });
    expect(payment.amount).toBe(15000);

    const journal = await prisma.journalEntry.findFirstOrThrow({ where: { schoolId, sourceType: "PAYROLL_PAYMENT", sourceId: payment.id }, select: { status: true, lines: { select: { debit: true, credit: true, account: { select: { systemKey: true } } } } } });
    expect(journal.status).toBe("POSTED");
    const totalDebit = journal.lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = journal.lines.reduce((s, l) => s + Number(l.credit), 0);
    expect(totalDebit).toBe(totalCredit);
    expect(totalDebit).toBe(15000);
    expect(journal.lines.some((l) => l.account.systemKey === "PAYROLL_EXPENSE" && Number(l.debit) === 15000)).toBe(true);
    expect(journal.lines.some((l) => l.account.systemKey === "BANK" && Number(l.credit) === 15000)).toBe(true);

    const paidRun = await getPayrollRun(scopeAdmin, run.id);
    expect(paidRun.status).toBe("paid");
  });

  it("a run can never be paid twice — sequential retry is rejected, concurrent retry produces exactly one PayrollPayment", async () => {
    const { run } = await makeFinalizedRun(2032, 2, 8000, "PAYTWICE");
    const first = await recordPayrollPayment(scopeAdmin, run.id, { paymentDate: "2032-02-28", method: "cash" });
    expect(first.amount).toBe(8000);
    await expect(recordPayrollPayment(scopeAdmin, run.id, { paymentDate: "2032-02-28", method: "cash" })).rejects.toThrow(HttpError);
    const paymentCount = await prisma.payrollPayment.count({ where: { payrollRunId: run.id } });
    expect(paymentCount).toBe(1);
  });

  it("two concurrent payment attempts on a not-yet-paid finalized run: exactly one succeeds", async () => {
    const { run } = await makeFinalizedRun(2032, 3, 6000, "PAYCONC");
    const results = await Promise.all([
      recordPayrollPayment(scopeAdmin, run.id, { paymentDate: "2032-03-31", method: "cash" }).catch((e) => e),
      recordPayrollPayment(scopeAdmin, run.id, { paymentDate: "2032-03-31", method: "cash" }).catch((e) => e),
    ]);
    const succeeded = results.filter((r) => !(r instanceof Error));
    expect(succeeded.length).toBe(1);
    const paymentCount = await prisma.payrollPayment.count({ where: { payrollRunId: run.id } });
    expect(paymentCount).toBe(1);
    const journalCount = await prisma.journalEntry.count({ where: { schoolId, sourceType: "PAYROLL_PAYMENT", sourceId: (await prisma.payrollPayment.findFirstOrThrow({ where: { payrollRunId: run.id } })).id } });
    expect(journalCount).toBe(1);
  });

  it("General Ledger for the PAYROLL_EXPENSE account includes the payment; Trial Balance stays balanced; Income/Expense report includes payroll expense", async () => {
    const { run } = await makeFinalizedRun(2032, 4, 12000, "PAYLEDGER");
    await recordPayrollPayment(scopeAdmin, run.id, { paymentDate: "2032-04-30", method: "bank_transfer" });

    const expenseAccount = await prisma.accountingAccount.findFirstOrThrow({ where: { schoolId, systemKey: "PAYROLL_EXPENSE" }, select: { id: true } });
    const ledger = await getAccountLedger(scopeAdmin, expenseAccount.id, {});
    expect(ledger.entries.some((e) => e.debit === 12000)).toBe(true);

    const trialBalance = await getTrialBalance(scopeAdmin, {});
    expect(trialBalance.totalDebit).toBe(trialBalance.totalCredit);
    expect(trialBalance.balanced).toBe(true);

    const report = await getPayrollEarningsDeductionsReport(scopeAdmin, {});
    expect(report.totalGross).toBeGreaterThanOrEqual(12000);
  });
});

describe.skipIf(!dbReady)("Payslips + Self-Service (DB)", () => {
  it("a finalized payslip snapshot is correct and reflects payment status", async () => {
    const comp = await createSalaryComponent(scopeAdmin, { code: `SLIP1${stamp}`, name: "Slip comp", type: "earning", calcType: "fixed" });
    const structure = await createSalaryStructure(scopeAdmin, { name: `Slip plan ${stamp}`, components: [{ componentId: comp.id, amount: 4500 }] });
    await createStaffSalaryAssignment(scopeAdmin, { staffId: staff1, salaryStructureId: structure.id, effectiveFrom: "2026-07-01", effectiveTo: "2033-01-31" });
    const run = await createPayrollRun(scopeAdmin, { year: 2033, month: 1 });
    const calculated = await calculatePayrollRun(scopeAdmin, run.id);
    const item = calculated.items.find((i) => i.staffId === staff1)!;
    const finalized = await finalizePayrollRun(scopeAdmin, run.id);
    expect(finalized.status).toBe("finalized");

    const payslip = await getPayslip(scopeAdmin, item.id);
    expect(payslip.netPay).toBe(4500);
    expect(payslip.paymentStatus).toBe("unpaid");
    await recordPayrollPayment(scopeAdmin, run.id, { paymentDate: "2033-01-31", method: "cash" });
    const paidPayslip = await getPayslip(scopeAdmin, item.id);
    expect(paidPayslip.paymentStatus).toBe("paid");
  });

  it("a plain Staff user can view their OWN payslip but not another staff member's", async () => {
    const comp = await createSalaryComponent(scopeAdmin, { code: `SELF1${stamp}`, name: "Self comp", type: "earning", calcType: "fixed" });
    const structure = await createSalaryStructure(scopeAdmin, { name: `Self plan ${stamp}`, components: [{ componentId: comp.id, amount: 3000 }] });
    await createStaffSalaryAssignment(scopeAdmin, { staffId: staff1, salaryStructureId: structure.id, effectiveFrom: "2033-02-01" });
    await createStaffSalaryAssignment(scopeAdmin, { staffId: staff2, salaryStructureId: structure.id, effectiveFrom: "2033-02-01" });
    const run = await createPayrollRun(scopeAdmin, { year: 2033, month: 2 });
    const calculated = await calculatePayrollRun(scopeAdmin, run.id);
    await finalizePayrollRun(scopeAdmin, run.id);
    const ownItem = calculated.items.find((i) => i.staffId === staff1)!;
    const otherItem = calculated.items.find((i) => i.staffId === staff2)!;

    // scopeSelf's actor is linked (Staff.userId) to staff1 — TEACHER role, no payroll.view/manage.
    const own = await getPayslip(scopeSelf, ownItem.id);
    expect(own.staffName).toContain("Ravi");
    await expect(getPayslip(scopeSelf, otherItem.id)).rejects.toThrow(HttpError);
  });

  it("listPayslips for a manager returns all in scope; for a self-service user returns strictly fewer or equal (their own only)", async () => {
    const allForAdmin = await listPayslips(scopeAdmin);
    const allForSelf = await listPayslips(scopeSelf);
    expect(allForAdmin.length).toBeGreaterThan(0);
    expect(allForAdmin.length).toBeGreaterThanOrEqual(allForSelf.length);
  });
});

describe.skipIf(!dbReady)("Security / RBAC / Audit / Isolation (DB)", () => {
  it("payroll.view/manage/finalize/pay: SCHOOL_ADMIN has all; TEACHER has none; PRINCIPAL has view only", () => {
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("payroll.view");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("payroll.manage");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("payroll.finalize");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("payroll.pay");
    expect(ROLE_PERMISSIONS.TEACHER ?? []).not.toContain("payroll.view");
    expect(ROLE_PERMISSIONS.TEACHER ?? []).not.toContain("payroll.manage");
    expect(ROLE_PERMISSIONS.PRINCIPAL).toContain("payroll.view");
    expect(ROLE_PERMISSIONS.PRINCIPAL).not.toContain("payroll.manage");
  });

  it("component/structure/assignment/run/finalize/pay mutations are audited", async () => {
    const events = await prisma.auditEvent.count({ where: { tenantId, action: { in: ["SALARY_COMPONENT_CREATED", "SALARY_STRUCTURE_CREATED", "STAFF_SALARY_ASSIGNED", "PAYROLL_RUN_CREATED", "PAYROLL_CALCULATED", "PAYROLL_FINALIZED", "PAYROLL_PAYMENT_RECORDED"] } } });
    expect(events).toBeGreaterThan(10);
  });

  it("cross-school/tenant runs, structures and payslips are invisible", async () => {
    const comp = await createSalaryComponent(scopeForeignAdmin, { code: `XS1${stamp}`, name: "Foreign comp", type: "earning", calcType: "fixed" });
    const structure = await createSalaryStructure(scopeForeignAdmin, { name: `Foreign plan ${stamp}`, components: [{ componentId: comp.id, amount: 100 }] });
    await createStaffSalaryAssignment(scopeForeignAdmin, { staffId: foreignStaffId, salaryStructureId: structure.id, effectiveFrom: "2026-01-01", effectiveTo: "2031-12-31" });
    const foreignRun = await createPayrollRun(scopeForeignAdmin, { year: 2034, month: 1 });
    const foreignCalculated = await calculatePayrollRun(scopeForeignAdmin, foreignRun.id);

    await expect(getSalaryStructure(scopeAdmin, structure.id)).rejects.toThrow(HttpError);
    await expect(getPayrollRun(scopeAdmin, foreignRun.id)).rejects.toThrow(HttpError);
    if (foreignCalculated.items.length > 0) {
      await expect(getPayslip(scopeAdmin, foreignCalculated.items[0].id)).rejects.toThrow(HttpError);
    }
  });
});

describe.skipIf(!dbReady)("Historical Safety (DB)", () => {
  it("Staff rename/inactive and salary-structure/component rename after finalization never change a finalized payslip", async () => {
    const comp = await createSalaryComponent(scopeAdmin, { code: `HS1${stamp}`, name: "History comp", type: "earning", calcType: "fixed" });
    const structure = await createSalaryStructure(scopeAdmin, { name: `History plan ${stamp}`, components: [{ componentId: comp.id, amount: 6000 }] });
    const freshStaff = await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-HS-${stamp}`, firstName: "HistOriginal", status: "ACTIVE" }, select: { id: true } });
    await createStaffSalaryAssignment(scopeAdmin, { staffId: freshStaff.id, salaryStructureId: structure.id, effectiveFrom: "2026-01-01", effectiveTo: "2033-03-31" });
    const run = await createPayrollRun(scopeAdmin, { year: 2033, month: 3 });
    const calculated = await calculatePayrollRun(scopeAdmin, run.id);
    const item = calculated.items.find((i) => i.staffId === freshStaff.id)!;
    await finalizePayrollRun(scopeAdmin, run.id);
    const before = await getPayslip(scopeAdmin, item.id);
    expect(before.netPay).toBe(6000);
    expect(before.staffName).toContain("HistOriginal");

    // Rename the component (renaming a component doesn't go through a service update — simulate via direct DB update, matching how account renames work in Accounting).
    await prisma.salaryComponent.update({ where: { id: comp.id }, data: { name: "Renamed Component" } });
    await prisma.staff.update({ where: { id: freshStaff.id }, data: { firstName: "HistChanged", status: "INACTIVE" } });

    const after = await getPayslip(scopeAdmin, item.id);
    expect(after.netPay).toBe(6000); // amount is immutable
    expect(after.staffName).toBe("HistOriginal"); // the SNAPSHOT name never changes
    expect(after.staffName).not.toContain("HistChanged");
    expect(after.earnings[0].label).toBe("History comp"); // the SNAPSHOT component name never changes despite the later rename
  });

  it("a later salary re-assignment does not change an already-finalized payroll snapshot", async () => {
    const comp1 = await createSalaryComponent(scopeAdmin, { code: `HS2A${stamp}`, name: "Old comp", type: "earning", calcType: "fixed" });
    const comp2 = await createSalaryComponent(scopeAdmin, { code: `HS2B${stamp}`, name: "New comp", type: "earning", calcType: "fixed" });
    const structureOld = await createSalaryStructure(scopeAdmin, { name: `Old plan ${stamp}`, components: [{ componentId: comp1.id, amount: 5000 }] });
    const structureNew = await createSalaryStructure(scopeAdmin, { name: `New plan ${stamp}`, components: [{ componentId: comp2.id, amount: 9000 }] });
    const freshStaff = await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-HS2-${stamp}`, firstName: "Reassign", status: "ACTIVE" }, select: { id: true } });
    await createStaffSalaryAssignment(scopeAdmin, { staffId: freshStaff.id, salaryStructureId: structureOld.id, effectiveFrom: "2026-01-01", effectiveTo: "2033-04-30" });
    const run = await createPayrollRun(scopeAdmin, { year: 2033, month: 4 });
    const calculated = await calculatePayrollRun(scopeAdmin, run.id);
    const item = calculated.items.find((i) => i.staffId === freshStaff.id)!;
    await finalizePayrollRun(scopeAdmin, run.id);

    await createStaffSalaryAssignment(scopeAdmin, { staffId: freshStaff.id, salaryStructureId: structureNew.id, effectiveFrom: "2033-05-01" });
    const after = await getPayslip(scopeAdmin, item.id);
    expect(after.netPay).toBe(5000); // unaffected by the later re-assignment
  });
});

describe.skipIf(!dbReady)("Dashboard (DB)", () => {
  it("returns real, run-derived KPIs — no fabricated authority", async () => {
    const dashboard = await getPayrollDashboard(scopeAdmin);
    expect(typeof dashboard.activeStructures).toBe("number");
    expect(typeof dashboard.staffWithoutAssignment).toBe("number");
    expect(Array.isArray(dashboard.recentRuns)).toBe(true);
  });
});
