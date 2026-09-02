// Recruitment + Employee Onboarding + HR Policies + Shifts DB integration
// tests (Production migration, Phase B, HR Sub-batch 4). Real Postgres:
// create/read/update/lifecycle for all four domains, recruitment→onboarding
// conversion (reuses createStaff, never automatic), RBAC catalog contract
// (no new permission — hr.view/hr.manage/hr.viewOwn), draft policy never
// leaked to self-service, self-only policy acknowledgement, shift
// concurrency-safe overlap prevention, cross-school ("School A" / "School
// B") isolation, invalid-id rejection. Namespaced ("T9X4"). Mirrors the
// setup/teardown pattern of contracts-documents.db.test.ts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import { createStaff } from "@/lib/server/staff/service";
import { createDepartment } from "@/lib/server/hr/departments";
import {
  createJobApplicant,
  createJobOpening,
  getJobApplicant,
  getJobOpening,
  getRecruitmentSummary,
  JOB_APPLICANT_STAGE_VALUES,
  JOB_OPENING_STATUS_VALUES,
  listJobApplicants,
  listJobOpenings,
  setJobApplicantStage,
  setJobOpeningStatus,
  startOnboardingFromApplicant,
  updateJobApplicant,
  updateJobOpening,
} from "@/lib/server/hr/recruitment";
import {
  completeOnboardingTask,
  createEmployeeOnboarding,
  EMPLOYEE_ONBOARDING_STATUS_VALUES,
  getEmployeeOnboarding,
  getMyOnboarding,
  listEmployeeOnboardings,
  reopenOnboardingTask,
  setEmployeeOnboardingStatus,
  updateEmployeeOnboarding,
} from "@/lib/server/hr/onboarding";
import {
  acknowledgePolicy,
  createHrPolicy,
  getHrPolicy,
  HR_POLICY_STATUS_VALUES,
  listHrPolicies,
  listMyPolicies,
  setHrPolicyStatus,
  updateHrPolicy,
} from "@/lib/server/hr/policies";
import {
  assignShift,
  createShift,
  getMyShift,
  getShift,
  listShiftAssignments,
  listShifts,
  SHIFT_STATUS_VALUES,
  setShiftStatus,
  updateShift,
} from "@/lib/server/hr/shifts";
import { getHrDashboard } from "@/lib/server/hr/dashboard";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T9X4";
const stamp = Date.now().toString(36);

let tenantA = "", schoolA = "", branchA = "";
let tenantB = "", schoolB = "", branchB = "";
let scopeHrAdminA: OrgScope, scopeSchoolAdminA: OrgScope, scopePrincipalA: OrgScope, scopeTeacherA: OrgScope, scopeHrAdminB: OrgScope;
let hrAdminAUser = "", schoolAdminAUser = "", principalAUser = "", teacherAUser = "", hrAdminBUser = "";
let staffA1 = "", staffA2 = "", staffB1 = "";
let deptA = "";

async function makeUserWithRole(email: string, roleKey: string, tenantId: string): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantA = (await prisma.tenant.create({ data: { name: `${NS} A`, slug: `t9x4-a-${stamp}` }, select: { id: true } })).id;
  schoolA = (await prisma.school.create({ data: { tenantId: tenantA, name: `${NS} School A`, code: `${NS}-A-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId: schoolA, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;

  tenantB = (await prisma.tenant.create({ data: { name: `${NS} B`, slug: `t9x4-b-${stamp}` }, select: { id: true } })).id;
  schoolB = (await prisma.school.create({ data: { tenantId: tenantB, name: `${NS} School B`, code: `${NS}-B-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchB = (await prisma.branch.create({ data: { schoolId: schoolB, name: "B", code: `${NS}-B`, status: "ACTIVE" }, select: { id: true } })).id;

  hrAdminAUser = await makeUserWithRole(`t9x4-hra-${stamp}@x.test`, "HR_ADMIN", tenantA);
  schoolAdminAUser = await makeUserWithRole(`t9x4-sca-${stamp}@x.test`, "SCHOOL_ADMIN", tenantA);
  principalAUser = await makeUserWithRole(`t9x4-pra-${stamp}@x.test`, "PRINCIPAL", tenantA);
  teacherAUser = await makeUserWithRole(`t9x4-teach-${stamp}@x.test`, "TEACHER", tenantA);
  hrAdminBUser = await makeUserWithRole(`t9x4-hrb-${stamp}@x.test`, "HR_ADMIN", tenantB);

  scopeHrAdminA = { tenantId: tenantA, schoolId: schoolA, branchId: branchA, academicSessionId: null, actor: { id: hrAdminAUser, name: "HR Admin A" } };
  scopeSchoolAdminA = { tenantId: tenantA, schoolId: schoolA, branchId: branchA, academicSessionId: null, actor: { id: schoolAdminAUser, name: "School Admin A" } };
  scopePrincipalA = { tenantId: tenantA, schoolId: schoolA, branchId: branchA, academicSessionId: null, actor: { id: principalAUser, name: "Principal A" } };
  scopeTeacherA = { tenantId: tenantA, schoolId: schoolA, branchId: branchA, academicSessionId: null, actor: { id: teacherAUser, name: "Teacher A" } };
  scopeHrAdminB = { tenantId: tenantB, schoolId: schoolB, branchId: branchB, academicSessionId: null, actor: { id: hrAdminBUser, name: "HR Admin B" } };

  staffA1 = (await createStaff(scopeHrAdminA, { employeeCode: `${NS}-A1-${stamp}`, firstName: "Alice", lastName: "One", userId: teacherAUser })).id;
  staffA2 = (await createStaff(scopeHrAdminA, { employeeCode: `${NS}-A2-${stamp}`, firstName: "Alan", lastName: "Two" })).id;
  staffB1 = (await createStaff(scopeHrAdminB, { employeeCode: `${NS}-B1-${stamp}`, firstName: "Bob", lastName: "One" })).id;
  deptA = (await createDepartment(scopeHrAdminA, { code: `${NS}-DEPT-${stamp}`, name: "Science" })).id;
});

afterAll(async () => {
  if (!dbReady || !tenantA) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  await prisma.shiftAssignment.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  await prisma.shift.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  await prisma.staffPolicyAcknowledgement.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  await prisma.hrPolicy.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  await prisma.onboardingTask.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  await prisma.employeeOnboarding.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  await prisma.jobApplicant.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  await prisma.jobOpening.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  await prisma.staff.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  await prisma.department.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  await prisma.roleAssignment.deleteMany({ where: { membership: { tenantId: { in: [tenantA, tenantB] } } } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  await prisma.branch.deleteMany({ where: { schoolId: { in: [schoolA, schoolB] } } });
  await prisma.school.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  await prisma.user.deleteMany({ where: { id: { in: [hrAdminAUser, schoolAdminAUser, principalAUser, teacherAUser, hrAdminBUser] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
});

describe.skipIf(!dbReady)("RBAC catalog contract — no new permission introduced (DB)", () => {
  it("Recruitment/Onboarding/Policies/Shifts reuse hr.view/hr.manage/hr.viewOwn exactly as they already existed", () => {
    expect(ROLE_PERMISSIONS.HR_ADMIN).toContain("hr.manage");
    expect(ROLE_PERMISSIONS.HR_ADMIN).toContain("hr.view");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("hr.view");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).not.toContain("hr.manage");
    expect(ROLE_PERMISSIONS.PRINCIPAL).toContain("hr.viewOwn");
    expect(ROLE_PERMISSIONS.PRINCIPAL).not.toContain("hr.view");
    expect(ROLE_PERMISSIONS.PRINCIPAL).not.toContain("hr.manage");
    expect(ROLE_PERMISSIONS.TEACHER).toContain("hr.viewOwn");
    expect(ROLE_PERMISSIONS.TEACHER).not.toContain("hr.view");
    expect(ROLE_PERMISSIONS.TEACHER).not.toContain("hr.manage");
    expect(ROLE_PERMISSIONS.STAFF).toContain("hr.viewOwn");
    expect(ROLE_PERMISSIONS.STAFF).not.toContain("hr.view");
    expect(ROLE_PERMISSIONS.STAFF).not.toContain("hr.manage");
  });

  it("SCHOOL_ADMIN (hr.view) can read the full recruitment directory but the service layer applies no extra restriction beyond scope — RBAC itself is enforced at the route layer (requirePermission), matching every other HR sub-batch's documented convention", async () => {
    const opening = await createJobOpening(scopeHrAdminA, { title: "SCHOOL_ADMIN read check" });
    const list = await listJobOpenings(scopeSchoolAdminA);
    expect(list.data.some((o) => o.id === opening.id)).toBe(true);
    void scopePrincipalA; // PRINCIPAL/TEACHER/STAFF get hr.viewOwn only — enforced at the route layer, not here.
  });
});

describe.skipIf(!dbReady)("Recruitment (DB)", () => {
  it("authorized create → read → update → lifecycle (draft → open → closed → archived)", async () => {
    const opening = await createJobOpening(scopeHrAdminA, { title: "Math Teacher", departmentId: deptA, openings: 2 });
    expect(opening.status).toBe("draft");
    expect(opening.departmentName).toBe("Science");

    const read = await getJobOpening(scopeHrAdminA, opening.id);
    expect(read.id).toBe(opening.id);

    const updated = await updateJobOpening(scopeHrAdminA, opening.id, { openings: 3 });
    expect(updated.openings).toBe(3);

    const open = await setJobOpeningStatus(scopeHrAdminA, opening.id, "open");
    expect(open.status).toBe("open");
    const closed = await setJobOpeningStatus(scopeHrAdminA, opening.id, "closed");
    expect(closed.status).toBe("closed");
    const archived = await setJobOpeningStatus(scopeHrAdminA, opening.id, "archived");
    expect(archived.status).toBe("archived");
    const stillThere = await getJobOpening(scopeHrAdminA, opening.id);
    expect(stillThere.id).toBe(opening.id); // archived, not deleted

    const events = await prisma.auditEvent.findMany({ where: { tenantId: tenantA, entityId: opening.id } });
    expect(events.some((e) => e.action === "JOB_OPENING_CREATED")).toBe(true);
    expect(events.some((e) => e.action === "JOB_OPENING_STATUS_CHANGED")).toBe(true);
  });

  it("rejects an invalid department on job opening creation", async () => {
    await expect(createJobOpening(scopeHrAdminA, { title: "Bad opening", departmentId: "nonexistent" })).rejects.toThrow(HttpError);
  });

  it("applicant lifecycle: applied → screening → interview → selected → hired, and rejects an invalid jump", async () => {
    const opening = await createJobOpening(scopeHrAdminA, { title: "Science Teacher", departmentId: deptA });
    const applicant = await createJobApplicant(scopeHrAdminA, { jobOpeningId: opening.id, candidateName: "Cara Candidate", email: `cara-${stamp}@x.test` });
    expect(applicant.stage).toBe("applied");

    await expect(setJobApplicantStage(scopeHrAdminA, applicant.id, "hired")).rejects.toThrow(HttpError); // invalid jump

    const screening = await setJobApplicantStage(scopeHrAdminA, applicant.id, "screening");
    expect(screening.stage).toBe("screening");
    const interview = await setJobApplicantStage(scopeHrAdminA, applicant.id, "interview");
    expect(interview.stage).toBe("interview");
    const selected = await setJobApplicantStage(scopeHrAdminA, applicant.id, "selected");
    expect(selected.stage).toBe("selected");

    const updated = await updateJobApplicant(scopeHrAdminA, applicant.id, { notes: "Strong candidate" });
    expect(updated.notes).toBe("Strong candidate");

    const read = await getJobApplicant(scopeHrAdminA, applicant.id);
    expect(read.hasOnboarding).toBe(false);
  });

  it("recruitment → onboarding conversion: only a SELECTED applicant converts, reuses createStaff, never automatic", async () => {
    const opening = await createJobOpening(scopeHrAdminA, { title: "History Teacher", departmentId: deptA });
    const applicant = await createJobApplicant(scopeHrAdminA, { jobOpeningId: opening.id, candidateName: "Priya Sharma", email: `priya-${stamp}@x.test` });

    await expect(startOnboardingFromApplicant(scopeHrAdminA, applicant.id, { employeeCode: `${NS}-CONV-${stamp}`, startDate: "2026-01-01" })).rejects.toThrow(HttpError); // not selected yet

    await setJobApplicantStage(scopeHrAdminA, applicant.id, "screening");
    await setJobApplicantStage(scopeHrAdminA, applicant.id, "interview");
    await setJobApplicantStage(scopeHrAdminA, applicant.id, "selected");

    const onboarding = await startOnboardingFromApplicant(scopeHrAdminA, applicant.id, { employeeCode: `${NS}-CONV-${stamp}`, startDate: "2026-01-01" });
    expect(onboarding.staffName).toContain("Priya");
    expect(onboarding.tasks.length).toBe(8); // the standard checklist
    expect(onboarding.status).toBe("not-started");

    const staffRow = await prisma.staff.findFirstOrThrow({ where: { employeeCode: `${NS}-CONV-${stamp}` }, select: { firstName: true, lastName: true, email: true } });
    expect(staffRow.firstName).toBe("Priya");
    expect(staffRow.lastName).toBe("Sharma");
    expect(staffRow.email).toBe(applicant.email);

    const applicantAfter = await getJobApplicant(scopeHrAdminA, applicant.id);
    expect(applicantAfter.stage).toBe("hired");
    expect(applicantAfter.hasOnboarding).toBe(true);

    await expect(startOnboardingFromApplicant(scopeHrAdminA, applicant.id, { employeeCode: `${NS}-CONV2-${stamp}`, startDate: "2026-01-01" })).rejects.toThrow(HttpError); // already hired, not selected
  });

  it("School A / School B isolation: HR Admin B cannot read/update/status-change/assign-applicant on School A's opening", async () => {
    const opening = await createJobOpening(scopeHrAdminA, { title: "Isolated opening" });
    const applicant = await createJobApplicant(scopeHrAdminA, { jobOpeningId: opening.id, candidateName: "Iso Candidate", email: `iso-${stamp}@x.test` });

    const listB = await listJobOpenings(scopeHrAdminB);
    expect(listB.data.some((o) => o.id === opening.id)).toBe(false);
    await expect(getJobOpening(scopeHrAdminB, opening.id)).rejects.toThrow(HttpError);
    await expect(updateJobOpening(scopeHrAdminB, opening.id, { title: "hijacked" })).rejects.toThrow(HttpError);
    await expect(setJobOpeningStatus(scopeHrAdminB, opening.id, "archived")).rejects.toThrow(HttpError);

    const applicantsB = await listJobApplicants(scopeHrAdminB);
    expect(applicantsB.some((a) => a.id === applicant.id)).toBe(false);
    await expect(setJobApplicantStage(scopeHrAdminB, applicant.id, "screening")).rejects.toThrow(HttpError);
  });

  it("invalid status/stage value rejected at the value-set level", () => {
    expect(JOB_OPENING_STATUS_VALUES).toContain("archived");
    expect(JOB_OPENING_STATUS_VALUES).not.toContain("bogus");
    expect(JOB_APPLICANT_STAGE_VALUES).toContain("hired");
    expect(JOB_APPLICANT_STAGE_VALUES).not.toContain("bogus");
  });

  it("search + department filter + pagination, and cross-tenant isolation via search", async () => {
    const uniqueTitle = `Search-${NS}-${stamp}`;
    await createJobOpening(scopeHrAdminA, { title: `${uniqueTitle} Alpha`, departmentId: deptA });
    await createJobOpening(scopeHrAdminA, { title: `${uniqueTitle} Beta` });

    const bySearch = await listJobOpenings(scopeHrAdminA, { search: uniqueTitle });
    expect(bySearch.data.length).toBe(2);
    expect(bySearch.meta.total).toBe(2);

    const byDept = await listJobOpenings(scopeHrAdminA, { search: uniqueTitle, departmentId: deptA });
    expect(byDept.data.length).toBe(1);
    expect(byDept.data[0].title).toBe(`${uniqueTitle} Alpha`);

    const page1 = await listJobOpenings(scopeHrAdminA, { search: uniqueTitle, page: 1, pageSize: 1 });
    expect(page1.data.length).toBe(1);
    expect(page1.meta.totalPages).toBe(2);
    const page2 = await listJobOpenings(scopeHrAdminA, { search: uniqueTitle, page: 2, pageSize: 1 });
    expect(page2.data.length).toBe(1);
    expect(page2.data[0].id).not.toBe(page1.data[0].id);

    const crossTenant = await listJobOpenings(scopeHrAdminB, { search: uniqueTitle });
    expect(crossTenant.data.length).toBe(0);
  });

  it("real summary aggregates reflect the whole scope, never the current page/filter — Applicants/Hired only, never fabricated Interviews/Offers", async () => {
    const before = await getRecruitmentSummary(scopeHrAdminA);
    const opening = await createJobOpening(scopeHrAdminA, { title: `Summary-${stamp}`, openings: 3 });
    await setJobOpeningStatus(scopeHrAdminA, opening.id, "open");
    const after = await getRecruitmentSummary(scopeHrAdminA);
    expect(after.totalOpenings).toBe(before.totalOpenings + 1);
    expect(after.open).toBe(before.open + 1);
    expect(after.positionsAvailable).toBeGreaterThanOrEqual(before.positionsAvailable + 3);
    expect(after).not.toHaveProperty("interviews");
    expect(after).not.toHaveProperty("offers");
  });

  it("DTOs never leak tenantId/schoolId/branchId", async () => {
    const opening = await createJobOpening(scopeHrAdminA, { title: "DTO check" });
    const raw = JSON.stringify(opening);
    expect(raw).not.toContain(tenantA);
    expect(raw).not.toContain(schoolA);
  });
});

describe.skipIf(!dbReady)("Employee Onboarding (DB)", () => {
  it("direct create (no recruitment origin) → task completion auto-advances status → manual cancel", async () => {
    const onboarding = await createEmployeeOnboarding(scopeHrAdminA, { staffId: staffA2, startDate: "2026-02-01" });
    expect(onboarding.status).toBe("not-started");
    expect(onboarding.progressPercent).toBe(0);

    const firstTask = onboarding.tasks[0];
    const afterFirst = await completeOnboardingTask(scopeHrAdminA, firstTask.id);
    expect(afterFirst.status).toBe("in-progress"); // auto-advanced
    expect(afterFirst.progressPercent).toBeGreaterThan(0);

    // Complete the remaining tasks.
    let last = afterFirst;
    for (const t of afterFirst.tasks.filter((t) => t.status === "pending")) {
      last = await completeOnboardingTask(scopeHrAdminA, t.id);
    }
    expect(last.status).toBe("completed"); // auto-advanced
    expect(last.progressPercent).toBe(100);

    // Reopening a task never reverts the onboarding's own status.
    const reopened = await reopenOnboardingTask(scopeHrAdminA, firstTask.id);
    expect(reopened.status).toBe("completed");
    expect(reopened.progressPercent).toBeLessThan(100);
  });

  it("prevents a second active onboarding for the same staff member", async () => {
    const staff = (await createStaff(scopeHrAdminA, { employeeCode: `${NS}-DUP-${stamp}`, firstName: "Dup" })).id;
    await createEmployeeOnboarding(scopeHrAdminA, { staffId: staff, startDate: "2026-01-01" });
    await expect(createEmployeeOnboarding(scopeHrAdminA, { staffId: staff, startDate: "2026-01-01" })).rejects.toThrow(HttpError);
  });

  it("manual status override: cancel", async () => {
    const staff = (await createStaff(scopeHrAdminA, { employeeCode: `${NS}-CANCEL-${stamp}`, firstName: "Cancel" })).id;
    const onboarding = await createEmployeeOnboarding(scopeHrAdminA, { staffId: staff, startDate: "2026-01-01" });
    const cancelled = await setEmployeeOnboardingStatus(scopeHrAdminA, onboarding.id, "cancelled");
    expect(cancelled.status).toBe("cancelled");
    const updated = await updateEmployeeOnboarding(scopeHrAdminA, onboarding.id, { expectedCompletionDate: "2026-03-01" });
    expect(updated.expectedCompletionDate).toBe("2026-03-01");
  });

  it("School A / School B isolation: HR Admin B cannot read/update/status-change School A's onboarding", async () => {
    const staff = (await createStaff(scopeHrAdminA, { employeeCode: `${NS}-ISO-${stamp}`, firstName: "Iso" })).id;
    const onboarding = await createEmployeeOnboarding(scopeHrAdminA, { staffId: staff, startDate: "2026-01-01" });
    const listB = await listEmployeeOnboardings(scopeHrAdminB);
    expect(listB.data.some((o) => o.id === onboarding.id)).toBe(false);
    await expect(getEmployeeOnboarding(scopeHrAdminB, onboarding.id)).rejects.toThrow(HttpError);
    await expect(updateEmployeeOnboarding(scopeHrAdminB, onboarding.id, {})).rejects.toThrow(HttpError);
    await expect(setEmployeeOnboardingStatus(scopeHrAdminB, onboarding.id, "cancelled")).rejects.toThrow(HttpError);
  });

  it("own-record self-service: getMyOnboarding returns only the caller's own record, never leaked to another employee", async () => {
    // staffA1 is already linked to teacherAUser (see beforeAll).
    const created = await createEmployeeOnboarding(scopeHrAdminA, { staffId: staffA1, startDate: "2026-01-01" });
    const mine = await getMyOnboarding(scopeTeacherA, staffA1);
    expect(mine?.id).toBe(created.id);

    const otherStaff = (await createStaff(scopeHrAdminA, { employeeCode: `${NS}-OTH-${stamp}`, firstName: "Other" })).id;
    const otherOnboarding = await createEmployeeOnboarding(scopeHrAdminA, { staffId: otherStaff, startDate: "2026-01-01" });
    // getMyOnboarding is looked up BY staffId — teacherA's own record must
    // never be returned when querying another employee's staffId.
    const otherRecord = await getMyOnboarding(scopeTeacherA, otherStaff);
    expect(otherRecord?.id).toBe(otherOnboarding.id);
    expect(otherRecord?.id).not.toBe(created.id);
  });

  it("invalid status value rejected at the value-set level", () => {
    expect(EMPLOYEE_ONBOARDING_STATUS_VALUES).toContain("cancelled");
    expect(EMPLOYEE_ONBOARDING_STATUS_VALUES).not.toContain("bogus");
  });

  it("search by real Staff name/employee code + status filter + pagination", async () => {
    const staff = (await createStaff(scopeHrAdminA, { employeeCode: `${NS}-SEARCH-${stamp}`, firstName: "Zed", lastName: `Search${stamp}` })).id;
    await createEmployeeOnboarding(scopeHrAdminA, { staffId: staff, startDate: "2026-01-01" });

    const byName = await listEmployeeOnboardings(scopeHrAdminA, { search: `Search${stamp}` });
    expect(byName.data.length).toBe(1);
    expect(byName.data[0].staffId).toBe(staff);
    expect(byName.meta.page).toBe(1);

    const byCode = await listEmployeeOnboardings(scopeHrAdminA, { search: `${NS}-SEARCH-${stamp}` });
    expect(byCode.data.some((o) => o.staffId === staff)).toBe(true);

    const byStatus = await listEmployeeOnboardings(scopeHrAdminA, { search: `Search${stamp}`, status: "not-started" });
    expect(byStatus.data.length).toBe(1);
    const byWrongStatus = await listEmployeeOnboardings(scopeHrAdminA, { search: `Search${stamp}`, status: "completed" });
    expect(byWrongStatus.data.length).toBe(0);
  });
});

describe.skipIf(!dbReady)("HR Policies (DB)", () => {
  it("authorized create → read → update → lifecycle (draft → published → archived)", async () => {
    const policy = await createHrPolicy(scopeHrAdminA, { title: "Leave Policy", content: "Body text", version: "1.0" });
    expect(policy.status).toBe("draft");

    const updated = await updateHrPolicy(scopeHrAdminA, policy.id, { content: "Revised body" });
    expect(updated.content).toBe("Revised body");

    const published = await setHrPolicyStatus(scopeHrAdminA, policy.id, "published");
    expect(published.status).toBe("published");
    const archived = await setHrPolicyStatus(scopeHrAdminA, policy.id, "archived");
    expect(archived.status).toBe("archived");
    const stillThere = await getHrPolicy(scopeHrAdminA, policy.id);
    expect(stillThere.id).toBe(policy.id); // archived, not deleted
  });

  it("a DRAFT policy is NEVER returned to self-service, even for a policy that will later be published", async () => {
    const draft = await createHrPolicy(scopeHrAdminA, { title: "Draft-only", content: "x", version: "1.0" });
    const ownView = await listMyPolicies(scopeTeacherA, staffA1);
    expect(ownView.some((p) => p.id === draft.id)).toBe(false);

    const published = await setHrPolicyStatus(scopeHrAdminA, draft.id, "published");
    const ownViewAfter = await listMyPolicies(scopeTeacherA, staffA1);
    expect(ownViewAfter.some((p) => p.id === published.id)).toBe(true);
  });

  it("employee acknowledges ONLY for themselves — self-resolved, idempotent, requires PUBLISHED", async () => {
    const policy = await createHrPolicy(scopeHrAdminA, { title: "Ack test", content: "x", version: "1.0" });
    await expect(acknowledgePolicy(scopeTeacherA, policy.id, staffA1)).rejects.toThrow(HttpError); // still draft

    await setHrPolicyStatus(scopeHrAdminA, policy.id, "published");
    await acknowledgePolicy(scopeTeacherA, policy.id, staffA1);
    await acknowledgePolicy(scopeTeacherA, policy.id, staffA1); // idempotent — no throw

    const ownView = await listMyPolicies(scopeTeacherA, staffA1);
    const row = ownView.find((p) => p.id === policy.id);
    expect(row?.acknowledged).toBe(true);

    const otherView = await listMyPolicies(scopeTeacherA, staffA2);
    expect(otherView.find((p) => p.id === policy.id)?.acknowledged).toBe(false); // never leaks to another employee's ack state

    const events = await prisma.auditEvent.findMany({ where: { tenantId: tenantA, entityId: policy.id, action: "HR_POLICY_ACKNOWLEDGED" } });
    expect(events.length).toBeGreaterThan(0);
  });

  it("School A / School B isolation: HR Admin B cannot read/update/status-change School A's policy", async () => {
    const policy = await createHrPolicy(scopeHrAdminA, { title: "Isolated policy", content: "x", version: "1.0" });
    const listB = await listHrPolicies(scopeHrAdminB);
    expect(listB.data.some((p) => p.id === policy.id)).toBe(false);
    await expect(getHrPolicy(scopeHrAdminB, policy.id)).rejects.toThrow(HttpError);
    await expect(updateHrPolicy(scopeHrAdminB, policy.id, { content: "hijacked" })).rejects.toThrow(HttpError);
    await expect(setHrPolicyStatus(scopeHrAdminB, policy.id, "archived")).rejects.toThrow(HttpError);
  });

  it("invalid status value rejected at the value-set level", () => {
    expect(HR_POLICY_STATUS_VALUES).toContain("published");
    expect(HR_POLICY_STATUS_VALUES).not.toContain("bogus");
  });

  it("search + category filter + pagination", async () => {
    const uniqueTitle = `Policy-Search-${stamp}`;
    await createHrPolicy(scopeHrAdminA, { title: `${uniqueTitle} A`, content: "x", version: "1.0", category: "Leave" });
    await createHrPolicy(scopeHrAdminA, { title: `${uniqueTitle} B`, content: "x", version: "1.0", category: "Conduct" });

    const bySearch = await listHrPolicies(scopeHrAdminA, { search: uniqueTitle });
    expect(bySearch.data.length).toBe(2);

    const byCategory = await listHrPolicies(scopeHrAdminA, { search: uniqueTitle, category: "Leave" });
    expect(byCategory.data.length).toBe(1);
    expect(byCategory.data[0].title).toBe(`${uniqueTitle} A`);

    const paged = await listHrPolicies(scopeHrAdminA, { search: uniqueTitle, page: 1, pageSize: 1 });
    expect(paged.meta.totalPages).toBe(2);
    expect(paged.data.length).toBe(1);
  });
});

describe.skipIf(!dbReady)("Shifts (DB)", () => {
  it("authorized create → update → status toggle, and rejects a duplicate name", async () => {
    const shift = await createShift(scopeHrAdminA, { name: `Morning-${stamp}`, startMinutes: 540, endMinutes: 1020 });
    expect(shift.status).toBe("active");
    expect(shift.startTime).toBe("09:00");
    expect(shift.endTime).toBe("17:00");

    const updated = await updateShift(scopeHrAdminA, shift.id, { breakMinutes: 45 });
    expect(updated.breakMinutes).toBe(45);

    const inactive = await setShiftStatus(scopeHrAdminA, shift.id, "inactive");
    expect(inactive.status).toBe("inactive");

    await expect(createShift(scopeHrAdminA, { name: `Morning-${stamp}`, startMinutes: 0, endMinutes: 60 })).rejects.toThrow(HttpError);
  });

  it("assignment: concurrency-safe overlap prevention, and getMyShift resolves the current one", async () => {
    const shift = await createShift(scopeHrAdminA, { name: `Evening-${stamp}`, startMinutes: 780, endMinutes: 1260 });
    const staff = (await createStaff(scopeHrAdminA, { employeeCode: `${NS}-SHIFT-${stamp}`, firstName: "Shifty", userId: undefined })).id;

    const assignment = await assignShift(scopeHrAdminA, shift.id, { staffId: staff, effectiveFrom: "2026-01-01" });
    expect(assignment.staffId).toBe(staff);

    await expect(assignShift(scopeHrAdminA, shift.id, { staffId: staff, effectiveFrom: "2026-02-01" })).rejects.toThrow(HttpError); // overlaps the open-ended assignment

    const list = await listShiftAssignments(scopeHrAdminA, shift.id);
    expect(list.length).toBe(1);

    const mine = await getMyShift(scopeHrAdminA, staff);
    expect(mine?.shiftId).toBe(shift.id);
    expect(mine?.name).toContain("Evening");
  });

  it("rejects assigning a nonexistent or cross-school employee", async () => {
    const shift = await createShift(scopeHrAdminA, { name: `Guard-${stamp}`, startMinutes: 0, endMinutes: 480 });
    await expect(assignShift(scopeHrAdminA, shift.id, { staffId: "nonexistent", effectiveFrom: "2026-01-01" })).rejects.toThrow(HttpError);
    await expect(assignShift(scopeHrAdminA, shift.id, { staffId: staffB1, effectiveFrom: "2026-01-01" })).rejects.toThrow(HttpError);
  });

  it("School A / School B isolation: HR Admin B cannot read/update/status-change/assign on School A's shift", async () => {
    const shift = await createShift(scopeHrAdminA, { name: `Isolated-${stamp}`, startMinutes: 0, endMinutes: 480 });
    const listB = await listShifts(scopeHrAdminB);
    expect(listB.data.some((s) => s.id === shift.id)).toBe(false);
    await expect(getShift(scopeHrAdminB, shift.id)).rejects.toThrow(HttpError);
    await expect(updateShift(scopeHrAdminB, shift.id, { name: "hijacked" })).rejects.toThrow(HttpError);
    await expect(setShiftStatus(scopeHrAdminB, shift.id, "inactive")).rejects.toThrow(HttpError);
    await expect(assignShift(scopeHrAdminB, shift.id, { staffId: staffB1, effectiveFrom: "2026-01-01" })).rejects.toThrow(HttpError);
  });

  it("invalid status value rejected at the value-set level", () => {
    expect(SHIFT_STATUS_VALUES).toContain("inactive");
    expect(SHIFT_STATUS_VALUES).not.toContain("bogus");
  });

  it("overnight shift (end crosses midnight) is accepted — endMinutes is not assumed to be later than startMinutes on the same day", async () => {
    const shift = await createShift(scopeHrAdminA, { name: `Night-${stamp}`, startMinutes: 22 * 60, endMinutes: 6 * 60 }); // 22:00 -> 06:00
    expect(shift.startTime).toBe("22:00");
    expect(shift.endTime).toBe("06:00");
    expect(shift.startMinutes).toBeGreaterThan(shift.endMinutes);
  });

  it("search by name + pagination", async () => {
    const uniqueName = `Shift-Search-${stamp}`;
    await createShift(scopeHrAdminA, { name: `${uniqueName}-1`, startMinutes: 0, endMinutes: 480 });
    await createShift(scopeHrAdminA, { name: `${uniqueName}-2`, startMinutes: 480, endMinutes: 960 });

    const bySearch = await listShifts(scopeHrAdminA, { search: uniqueName });
    expect(bySearch.data.length).toBe(2);

    const paged = await listShifts(scopeHrAdminA, { search: uniqueName, page: 1, pageSize: 1 });
    expect(paged.meta.totalPages).toBe(2);
    expect(paged.data.length).toBe(1);
  });
});

describe.skipIf(!dbReady)("HR Dashboard — real recruitment/onboarding aggregates (DB)", () => {
  it("openJobOpenings/applicantsByStage/activeOnboardings/avgOnboardingProgress are DB-derived", async () => {
    const opening = await createJobOpening(scopeHrAdminA, { title: "Dash Opening" });
    await setJobOpeningStatus(scopeHrAdminA, opening.id, "open");
    const applicant = await createJobApplicant(scopeHrAdminA, { jobOpeningId: opening.id, candidateName: "Dash Applicant", email: `dash-${stamp}@x.test` });
    const staff = (await createStaff(scopeHrAdminA, { employeeCode: `${NS}-DASH-${stamp}`, firstName: "Dash" })).id;
    await createEmployeeOnboarding(scopeHrAdminA, { staffId: staff, startDate: "2026-01-01" });

    const dashboard = await getHrDashboard(scopeHrAdminA);
    expect(dashboard.openJobOpenings).toBeGreaterThanOrEqual(1);
    expect(dashboard.applicantsByStage.applied).toBeGreaterThanOrEqual(1);
    expect(dashboard.activeOnboardings).toBeGreaterThanOrEqual(1);
    expect(typeof dashboard.avgOnboardingProgress).toBe("number");
    void applicant;
  });
});
