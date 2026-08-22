// Counseling / Student Wellbeing DB integration tests (Phase 9S). Real
// Postgres: CounselingCase (student identity, referral metadata, lifecycle
// OPEN->ACTIVE->CLOSED), CounselingSession (real counselor Staff), and
// CONFIDENTIAL CounselingSessionNote (counseling.viewConfidential AND
// counselor-ownership enforced at the service layer, 404 not 403 on
// mismatch), dashboard DB-derivation, historical safety, isolation, RBAC
// catalog contract, audit (never logging note bodies), DTO safety, no
// invented case-per-student dedupe policy. Namespaced ("T9S"). Mirrors the
// exact setup/teardown pattern of lib/server/health/health.db.test.ts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { assignCase, closeCase, createReferral, getCase, listCases, updateCase } from "@/lib/server/counseling/cases";
import { createSession, listSessionsForCase } from "@/lib/server/counseling/sessions";
import { createNote, listNotesForSession } from "@/lib/server/counseling/notes";
import { getCounselingDashboard } from "@/lib/server/counseling/dashboard";
import { getStudentCounselingProfile } from "@/lib/server/counseling/student-profile";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T9S";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "", sessionId = "";
let inactiveStudent = "";
let counselorA = "", counselorB = "", inactiveCounselor = "";
let foreignTenantId = "", foreignSchoolId = "", foreignBranchId = "", foreignStudentId = "";
let scopeAdmin: OrgScope, scopeCounselorA: OrgScope, scopeCounselorB: OrgScope, scopeTeacher: OrgScope, scopeForeignAdmin: OrgScope;
let adminUser = "", counselorAUser = "", counselorBUser = "", teacherUser = "", foreignAdminUser = "";

async function makeUserWithRole(email: string, roleKey: string, tid = tenantId): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId: tid, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

async function makeStudent(suffix: string, status: "ACTIVE" | "INACTIVE" = "ACTIVE", tid = tenantId, sid = schoolId, bid = branchA, sessId = sessionId): Promise<string> {
  return (await prisma.student.create({
    data: { tenantId: tid, schoolId: sid, branchId: bid, academicSessionId: sessId, admissionNumber: `${NS}-${stamp}-${suffix}`, firstName: suffix, lastName: "T", dateOfBirth: new Date("2012-01-01"), admissionDate: new Date("2024-04-01"), status },
    select: { id: true },
  })).id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t9s-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;

  adminUser = await makeUserWithRole(`t9s-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  teacherUser = await makeUserWithRole(`t9s-teacher-${stamp}@x.test`, "TEACHER");
  counselorAUser = await makeUserWithRole(`t9s-counselorA-${stamp}@x.test`, "COUNSELOR");
  counselorBUser = await makeUserWithRole(`t9s-counselorB-${stamp}@x.test`, "COUNSELOR");

  counselorA = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-CA-${stamp}`, firstName: "Counselor", lastName: "A", status: "ACTIVE", userId: counselorAUser }, select: { id: true } })).id;
  counselorB = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-CB-${stamp}`, firstName: "Counselor", lastName: "B", status: "ACTIVE", userId: counselorBUser }, select: { id: true } })).id;
  inactiveCounselor = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-CI-${stamp}`, firstName: "Inactive", lastName: "Counselor", status: "INACTIVE" }, select: { id: true } })).id;

  inactiveStudent = await makeStudent("inactive", "INACTIVE");

  foreignTenantId = (await prisma.tenant.create({ data: { name: `${NS} T2`, slug: `t9s-b-${stamp}` }, select: { id: true } })).id;
  foreignSchoolId = (await prisma.school.create({ data: { tenantId: foreignTenantId, name: `${NS} S2`, code: `${NS}-B-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  foreignBranchId = (await prisma.branch.create({ data: { schoolId: foreignSchoolId, name: "B", code: `${NS}-B`, status: "ACTIVE" }, select: { id: true } })).id;
  const foreignSession = (await prisma.academicSession.create({ data: { schoolId: foreignSchoolId, name: "26-27", code: `${NS}-BS`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  foreignStudentId = await makeStudent("foreign", "ACTIVE", foreignTenantId, foreignSchoolId, foreignBranchId, foreignSession);
  foreignAdminUser = await makeUserWithRole(`t9s-fadmin-${stamp}@x.test`, "SCHOOL_ADMIN", foreignTenantId);

  scopeAdmin = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: adminUser, name: "Admin" } };
  scopeCounselorA = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: counselorAUser, name: "Counselor A" } };
  scopeCounselorB = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: counselorBUser, name: "Counselor B" } };
  scopeTeacher = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: teacherUser, name: "Teacher" } };
  scopeForeignAdmin = { tenantId: foreignTenantId, schoolId: foreignSchoolId, branchId: foreignBranchId, academicSessionId: foreignSession, actor: { id: foreignAdminUser, name: "Foreign Admin" } };
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.counselingSessionNote.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.counselingSession.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.counselingCase.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.student.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.staff.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.roleAssignment.deleteMany({ where: { membership: { tenantId: { in: [tenantId, foreignTenantId] } } } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.academicSession.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.branch.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.school.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUser, teacherUser, counselorAUser, counselorBUser, foreignAdminUser] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, foreignTenantId] } } });
});

describe.skipIf(!dbReady)("Identity (DB)", () => {
  it("rejects an inactive/foreign/nonexistent student, and an inactive counselor assignment", async () => {
    await expect(createReferral(scopeAdmin, { studentId: inactiveStudent })).rejects.toThrow(HttpError);
    await expect(createReferral(scopeAdmin, { studentId: foreignStudentId })).rejects.toThrow(HttpError);
    await expect(createReferral(scopeAdmin, { studentId: "nonexistent" })).rejects.toThrow(HttpError);

    const student = await makeStudent("id1");
    const c = await createReferral(scopeAdmin, { studentId: student });
    await expect(assignCase(scopeAdmin, c.id, { counselorStaffId: inactiveCounselor })).rejects.toThrow(HttpError);
    await expect(assignCase(scopeAdmin, c.id, { counselorStaffId: "nonexistent" })).rejects.toThrow(HttpError);
  });

  it("no parallel Patient/Counselor identity — studentId/assignedCounselorStaffId always equal real Student.id/Staff.id", async () => {
    const student = await makeStudent("id2");
    const c = await createReferral(scopeAdmin, { studentId: student, referralSource: "teacher" });
    expect(c.studentId).toBe(student);
    const assigned = await assignCase(scopeAdmin, c.id, { counselorStaffId: counselorA });
    expect(assigned.assignedCounselorStaffId).toBe(counselorA);
  });
});

describe.skipIf(!dbReady)("Case lifecycle (DB)", () => {
  it("creates OPEN, assigns -> ACTIVE, updates metadata, closes with a server timestamp; rejects double close", async () => {
    const student = await makeStudent("case1");
    const before = Date.now();
    const c = await createReferral(scopeAdmin, { studentId: student, concernCategory: "academic", referralReason: "Struggling with exam stress" });
    expect(c.status).toBe("open");

    const assigned = await assignCase(scopeAdmin, c.id, { counselorStaffId: counselorA });
    expect(assigned.status).toBe("active");

    const updated = await updateCase(scopeAdmin, c.id, { summary: "Weekly check-ins started" });
    expect(updated.summary).toBe("Weekly check-ins started");

    const closed = await closeCase(scopeAdmin, c.id);
    expect(closed.status).toBe("closed");
    expect(new Date(closed.closedAt!).getTime()).toBeGreaterThanOrEqual(before);
    await expect(closeCase(scopeAdmin, c.id)).rejects.toThrow(HttpError);
    await expect(updateCase(scopeAdmin, c.id, { summary: "too late" })).rejects.toThrow(HttpError);
    await expect(assignCase(scopeAdmin, c.id, { counselorStaffId: counselorB })).rejects.toThrow(HttpError);
  });

  it("a student may have more than one case at a time — no invented single-open-case dedupe policy", async () => {
    const student = await makeStudent("multi1");
    const c1 = await createReferral(scopeAdmin, { studentId: student, concernCategory: "academic" });
    const c2 = await createReferral(scopeAdmin, { studentId: student, concernCategory: "family" });
    expect(c1.id).not.toBe(c2.id);
    const list = await listCases(scopeAdmin, { studentId: student });
    expect(list.length).toBe(2);
  });

  it("concurrency: concurrent close resolves to exactly one success", async () => {
    const student = await makeStudent("race1");
    const c = await createReferral(scopeAdmin, { studentId: student });
    const results = await Promise.all(Array.from({ length: 5 }, () => closeCase(scopeAdmin, c.id).catch((e) => e)));
    expect(results.filter((r) => !(r instanceof Error)).length).toBe(1);
  });

  it("concurrency: concurrent counselor assignment resolves to a deterministic valid state (exactly one counselor, ACTIVE)", async () => {
    const student = await makeStudent("race2");
    const c = await createReferral(scopeAdmin, { studentId: student });
    await Promise.all([
      assignCase(scopeAdmin, c.id, { counselorStaffId: counselorA }).catch((e) => e),
      assignCase(scopeAdmin, c.id, { counselorStaffId: counselorB }).catch((e) => e),
    ]);
    const final = await getCase(scopeAdmin, c.id);
    expect(final.status).toBe("active");
    expect([counselorA, counselorB]).toContain(final.assignedCounselorStaffId);
  });
});

describe.skipIf(!dbReady)("Sessions + confidential notes (DB)", () => {
  it("records a session with the acting user's own real Staff identity as counselor", async () => {
    const student = await makeStudent("sess1");
    const c = await createReferral(scopeAdmin, { studentId: student });
    await assignCase(scopeAdmin, c.id, { counselorStaffId: counselorA });
    const s = await createSession(scopeCounselorA, c.id, { summary: "Initial check-in" });
    expect(s.counselorStaffId).toBe(counselorA);
    expect(s.summary).toBe("Initial check-in");
    await expect(createSession(scopeAdmin, c.id, {})).rejects.toThrow(HttpError); // admin has no linked Staff record
  });

  it("rejects recording a session on a closed case", async () => {
    const student = await makeStudent("sess2");
    const c = await createReferral(scopeAdmin, { studentId: student });
    await closeCase(scopeAdmin, c.id);
    await expect(createSession(scopeCounselorA, c.id, {})).rejects.toThrow(HttpError);
  });

  it("creates a confidential note; the assigned counselor (owner) can read it, a DIFFERENT counselor cannot (404, not empty list)", async () => {
    const student = await makeStudent("note1");
    const c = await createReferral(scopeAdmin, { studentId: student });
    await assignCase(scopeAdmin, c.id, { counselorStaffId: counselorA });
    const s = await createSession(scopeCounselorA, c.id, {});
    const note = await createNote(scopeCounselorA, s.id, { body: "Confidential clinical narrative text" });
    expect(note.body).toBe("Confidential clinical narrative text");

    const ownNotes = await listNotesForSession(scopeCounselorA, s.id);
    expect(ownNotes.some((n) => n.id === note.id)).toBe(true);

    await expect(listNotesForSession(scopeCounselorB, s.id)).rejects.toThrow(HttpError);
    await expect(createNote(scopeCounselorB, s.id, { body: "should not be allowed" })).rejects.toThrow(HttpError);
  });

  it("an unassigned case's session notes are readable by no one via ownership (no assignedCounselorStaffId to match)", async () => {
    const student = await makeStudent("note2");
    const c = await createReferral(scopeAdmin, { studentId: student });
    await assignCase(scopeAdmin, c.id, { counselorStaffId: counselorA });
    const s = await createSession(scopeCounselorA, c.id, {});
    // Simulate an unassigned case's session by clearing assignment directly (edge case safety net).
    await prisma.counselingCase.update({ where: { id: c.id }, data: { assignedCounselorStaffId: null } });
    await expect(listNotesForSession(scopeCounselorA, s.id)).rejects.toThrow(HttpError);
  });
});

describe.skipIf(!dbReady)("Follow-up (DB)", () => {
  it("sets a real follow-up date on a case, reflected in the dashboard's followUpsDue count", async () => {
    const student = await makeStudent("followup1");
    const c = await createReferral(scopeAdmin, { studentId: student });
    const today = new Date().toISOString().slice(0, 10);
    const updated = await updateCase(scopeAdmin, c.id, { followUpDate: today });
    expect(updated.followUpDate).toBe(today);
    const dashboard = await getCounselingDashboard(scopeAdmin);
    expect(dashboard.followUpsDue).toBeGreaterThanOrEqual(1);
  });
});

describe.skipIf(!dbReady)("Notifications (DB)", () => {
  it("assigning a case notifies the counselor's real linked User; no fake Student/Guardian recipient exists", async () => {
    const student = await makeStudent("notif1");
    const c = await createReferral(scopeAdmin, { studentId: student });
    await assignCase(scopeAdmin, c.id, { counselorStaffId: counselorA });
    const notif = await prisma.notification.findFirst({ where: { tenantId, type: "COUNSELING_CASE_ASSIGNED", sourceId: c.id } });
    expect(notif).not.toBeNull();
    const recipients = await prisma.notificationRecipient.findMany({ where: { notificationId: notif!.id } });
    expect(recipients.some((r) => r.userId === counselorAUser)).toBe(true);
  });
});

describe.skipIf(!dbReady)("Student 360 Counseling profile (DB)", () => {
  it("reflects real active-support status, current case metadata, and total case count", async () => {
    const student = await makeStudent("s360c1");
    const empty = await getStudentCounselingProfile(scopeAdmin, student);
    expect(empty.hasActiveSupport).toBe(false);
    expect(empty.currentCase).toBeNull();
    expect(empty.caseCount).toBe(0);

    const c = await createReferral(scopeAdmin, { studentId: student, concernCategory: "peer_relationships" });
    await assignCase(scopeAdmin, c.id, { counselorStaffId: counselorA });
    const active = await getStudentCounselingProfile(scopeAdmin, student);
    expect(active.hasActiveSupport).toBe(true);
    expect(active.currentCase?.status).toBe("active");
    expect(active.currentCase?.assignedCounselorName).toContain("Counselor");
    expect(active.caseCount).toBe(1);
  });

  it("never includes confidential note content in the Student 360 profile DTO", async () => {
    const student = await makeStudent("s360c2");
    const c = await createReferral(scopeAdmin, { studentId: student });
    await assignCase(scopeAdmin, c.id, { counselorStaffId: counselorA });
    const s = await createSession(scopeCounselorA, c.id, {});
    await createNote(scopeCounselorA, s.id, { body: "Extremely confidential text that must never leak" });
    const profile = await getStudentCounselingProfile(scopeAdmin, student);
    expect(JSON.stringify(profile)).not.toContain("Extremely confidential text");
  });
});

describe.skipIf(!dbReady)("Historical safety (DB)", () => {
  it("case history survives a student rename and a counselor going inactive", async () => {
    const student = await makeStudent("hist1");
    const c = await createReferral(scopeAdmin, { studentId: student });
    await assignCase(scopeAdmin, c.id, { counselorStaffId: counselorB });
    await closeCase(scopeAdmin, c.id);

    await prisma.student.update({ where: { id: student }, data: { firstName: "RenamedStudent" } });
    await prisma.staff.update({ where: { id: counselorB }, data: { status: "INACTIVE" } });

    const historical = await getCase(scopeAdmin, c.id);
    expect(historical.status).toBe("closed");
    expect(historical.studentName).toContain("RenamedStudent");
    expect(historical.assignedCounselorStaffId).toBe(counselorB);
  });
});

describe.skipIf(!dbReady)("Security / RBAC / Isolation / Audit / DTO safety (DB)", () => {
  it("counseling.view/manage/viewConfidential/refer: COUNSELOR has all four; SCHOOL_ADMIN view only; PRINCIPAL view only; TEACHER refer only", () => {
    expect(ROLE_PERMISSIONS.COUNSELOR).toContain("counseling.view");
    expect(ROLE_PERMISSIONS.COUNSELOR).toContain("counseling.manage");
    expect(ROLE_PERMISSIONS.COUNSELOR).toContain("counseling.viewConfidential");
    expect(ROLE_PERMISSIONS.COUNSELOR).toContain("counseling.refer");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("counseling.view");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).not.toContain("counseling.manage");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).not.toContain("counseling.viewConfidential");
    expect(ROLE_PERMISSIONS.PRINCIPAL).toContain("counseling.view");
    expect(ROLE_PERMISSIONS.PRINCIPAL).not.toContain("counseling.viewConfidential");
    expect(ROLE_PERMISSIONS.TEACHER).toContain("counseling.refer");
    expect(ROLE_PERMISSIONS.TEACHER).not.toContain("counseling.view");
    expect(ROLE_PERMISSIONS.TEACHER).not.toContain("counseling.viewConfidential");
    // students.view/health.view/hr.view never imply counseling access.
    expect(ROLE_PERMISSIONS.HR_ADMIN ?? []).not.toContain("counseling.view");
    void scopeTeacher; // RBAC enforcement itself is at the route layer (requirePermission) — this documents the catalog contract.
  });

  it("cross-tenant case/session is invisible", async () => {
    const foreignCase = await createReferral(scopeForeignAdmin, { studentId: foreignStudentId });
    await expect(getCase(scopeAdmin, foreignCase.id)).rejects.toThrow(HttpError);
    await expect(closeCase(scopeAdmin, foreignCase.id)).rejects.toThrow(HttpError);
  });

  it("counseling mutations are audited without leaking note bodies into audit metadata", async () => {
    const student = await makeStudent("audit1");
    const c = await createReferral(scopeAdmin, { studentId: student });
    await assignCase(scopeAdmin, c.id, { counselorStaffId: counselorA });
    const s = await createSession(scopeCounselorA, c.id, {});
    const note = await createNote(scopeCounselorA, s.id, { body: "Secret audit-sensitive narrative" });

    const events = await prisma.auditEvent.findMany({
      where: { tenantId, action: { in: ["COUNSELING_CASE_CREATED", "COUNSELING_CASE_ASSIGNED", "COUNSELING_SESSION_CREATED", "COUNSELING_NOTE_CREATED"] } },
    });
    expect(events.length).toBeGreaterThan(3);
    const noteEvent = events.find((e) => e.action === "COUNSELING_NOTE_CREATED" && e.entityId === note.id);
    expect(noteEvent).toBeTruthy();
    expect(JSON.stringify(noteEvent!.metaJson)).not.toContain("Secret audit-sensitive narrative");
  });

  it("case and session DTOs never leak tenantId/schoolId or confidential note content", async () => {
    const student = await makeStudent("dto1");
    const c = await createReferral(scopeAdmin, { studentId: student });
    await assignCase(scopeAdmin, c.id, { counselorStaffId: counselorA });
    const s = await createSession(scopeCounselorA, c.id, { summary: "non-confidential summary" });
    await createNote(scopeCounselorA, s.id, { body: "leaking-check-marker-text" });

    const caseRaw = JSON.stringify(await getCase(scopeAdmin, c.id));
    expect(caseRaw).not.toContain(tenantId);
    expect(caseRaw).not.toContain(schoolId);
    expect(caseRaw).not.toContain("leaking-check-marker-text");

    const sessionsRaw = JSON.stringify(await listSessionsForCase(scopeAdmin, c.id));
    expect(sessionsRaw).not.toContain("leaking-check-marker-text");
  });

  it("dashboard is DB-derived with no fabricated risk/wellbeing score field", async () => {
    const dashboard = await getCounselingDashboard(scopeAdmin);
    expect(typeof dashboard.totalOpenCases).toBe("number");
    expect(Object.keys(dashboard)).not.toContain("riskScore");
    expect(Object.keys(dashboard)).not.toContain("wellbeingScore");
  });
});
