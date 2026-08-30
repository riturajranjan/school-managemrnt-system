// Performance Reviews + Training DB integration tests (Production migration,
// Phase B, HR Sub-batch 3). Real Postgres: create/read/update/lifecycle for
// both domains, reviewer validation, RBAC catalog contract (no new
// permission — hr.view/hr.manage/hr.viewOwn), draft/internal review never
// leaked through self-service, training participant assignment + completion,
// cross-school ("School A" / "School B") isolation, invalid-id rejection,
// and self-service own-record-only integration. Namespaced ("T9X3").
// Mirrors the setup/teardown pattern of contracts-documents.db.test.ts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import { createStaff } from "@/lib/server/staff/service";
import {
  createPerformanceReview,
  getPerformanceReview,
  listMyPerformanceReviews,
  listPerformanceReviews,
  PERFORMANCE_REVIEW_STATUS_VALUES,
  setPerformanceReviewStatus,
  updatePerformanceReview,
} from "@/lib/server/hr/performance";
import {
  assignTrainingParticipant,
  createTrainingProgram,
  getTrainingProgram,
  listMyTrainingAssignments,
  listTrainingParticipants,
  listTrainingPrograms,
  setTrainingParticipantStatus,
  setTrainingProgramStatus,
  TRAINING_PROGRAM_STATUS_VALUES,
  updateTrainingProgram,
} from "@/lib/server/hr/training";
import { getMySelfService } from "@/lib/server/hr/self-service";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T9X3";
const stamp = Date.now().toString(36);

let tenantA = "", schoolA = "", branchA = "";
let tenantB = "", schoolB = "", branchB = "";
let scopeHrAdminA: OrgScope, scopeSchoolAdminA: OrgScope, scopeTeacherA: OrgScope, scopeHrAdminB: OrgScope;
let hrAdminAUser = "", schoolAdminAUser = "", teacherAUser = "", hrAdminBUser = "";
let staffA1 = "", staffA2 = "", staffA3 = "", staffB1 = "";

async function makeUserWithRole(email: string, roleKey: string, tenantId: string): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantA = (await prisma.tenant.create({ data: { name: `${NS} A`, slug: `t9x3-a-${stamp}` }, select: { id: true } })).id;
  schoolA = (await prisma.school.create({ data: { tenantId: tenantA, name: `${NS} School A`, code: `${NS}-A-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId: schoolA, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;

  tenantB = (await prisma.tenant.create({ data: { name: `${NS} B`, slug: `t9x3-b-${stamp}` }, select: { id: true } })).id;
  schoolB = (await prisma.school.create({ data: { tenantId: tenantB, name: `${NS} School B`, code: `${NS}-B-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchB = (await prisma.branch.create({ data: { schoolId: schoolB, name: "B", code: `${NS}-B`, status: "ACTIVE" }, select: { id: true } })).id;

  hrAdminAUser = await makeUserWithRole(`t9x3-hra-${stamp}@x.test`, "HR_ADMIN", tenantA);
  schoolAdminAUser = await makeUserWithRole(`t9x3-sca-${stamp}@x.test`, "SCHOOL_ADMIN", tenantA);
  teacherAUser = await makeUserWithRole(`t9x3-teach-${stamp}@x.test`, "TEACHER", tenantA);
  hrAdminBUser = await makeUserWithRole(`t9x3-hrb-${stamp}@x.test`, "HR_ADMIN", tenantB);

  scopeHrAdminA = { tenantId: tenantA, schoolId: schoolA, branchId: branchA, academicSessionId: null, actor: { id: hrAdminAUser, name: "HR Admin A" } };
  scopeSchoolAdminA = { tenantId: tenantA, schoolId: schoolA, branchId: branchA, academicSessionId: null, actor: { id: schoolAdminAUser, name: "School Admin A" } };
  scopeTeacherA = { tenantId: tenantA, schoolId: schoolA, branchId: branchA, academicSessionId: null, actor: { id: teacherAUser, name: "Teacher A" } };
  scopeHrAdminB = { tenantId: tenantB, schoolId: schoolB, branchId: branchB, academicSessionId: null, actor: { id: hrAdminBUser, name: "HR Admin B" } };

  staffA1 = (await createStaff(scopeHrAdminA, { employeeCode: `${NS}-A1-${stamp}`, firstName: "Alice", lastName: "One", userId: teacherAUser })).id;
  staffA2 = (await createStaff(scopeHrAdminA, { employeeCode: `${NS}-A2-${stamp}`, firstName: "Alan", lastName: "Two" })).id;
  staffA3 = (await createStaff(scopeHrAdminA, { employeeCode: `${NS}-A3-${stamp}`, firstName: "Anita", lastName: "Three" })).id;
  staffB1 = (await createStaff(scopeHrAdminB, { employeeCode: `${NS}-B1-${stamp}`, firstName: "Bob", lastName: "One" })).id;
});

afterAll(async () => {
  if (!dbReady || !tenantA) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  await prisma.trainingParticipant.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  await prisma.trainingProgram.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  await prisma.performanceReview.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  await prisma.staff.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  await prisma.roleAssignment.deleteMany({ where: { membership: { tenantId: { in: [tenantA, tenantB] } } } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  await prisma.branch.deleteMany({ where: { schoolId: { in: [schoolA, schoolB] } } });
  await prisma.school.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  await prisma.user.deleteMany({ where: { id: { in: [hrAdminAUser, schoolAdminAUser, teacherAUser, hrAdminBUser] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
});

describe.skipIf(!dbReady)("RBAC catalog contract — no new permission introduced (DB)", () => {
  it("Performance/Training reuse hr.view/hr.manage/hr.viewOwn exactly as they already existed", () => {
    expect(ROLE_PERMISSIONS.HR_ADMIN).toContain("hr.manage");
    expect(ROLE_PERMISSIONS.HR_ADMIN).toContain("hr.view");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("hr.view");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).not.toContain("hr.manage");
    expect(ROLE_PERMISSIONS.TEACHER).toContain("hr.viewOwn");
    expect(ROLE_PERMISSIONS.TEACHER).not.toContain("hr.view");
    expect(ROLE_PERMISSIONS.TEACHER).not.toContain("hr.manage");
  });
});

describe.skipIf(!dbReady)("Performance Reviews (DB)", () => {
  it("authorized create → read → update → lifecycle (draft → in-review → completed → archived)", async () => {
    const created = await createPerformanceReview(scopeHrAdminA, {
      staffId: staffA2, reviewerId: staffA3, reviewPeriodStart: "2026-01-01", reviewPeriodEnd: "2026-06-30",
      overallRating: 4, summary: "Solid performance", comments: "Keep it up",
    });
    expect(created.status).toBe("draft");
    expect(created.staffId).toBe(staffA2);
    expect(created.reviewerId).toBe(staffA3);

    const read = await getPerformanceReview(scopeHrAdminA, created.id);
    expect(read.id).toBe(created.id);
    expect(read.overallRating).toBe(4);

    const updated = await updatePerformanceReview(scopeHrAdminA, created.id, { summary: "Revised summary" });
    expect(updated.summary).toBe("Revised summary");

    const inReview = await setPerformanceReviewStatus(scopeHrAdminA, created.id, "in-review");
    expect(inReview.status).toBe("in-review");
    const completed = await setPerformanceReviewStatus(scopeHrAdminA, created.id, "completed");
    expect(completed.status).toBe("completed");
    const archived = await setPerformanceReviewStatus(scopeHrAdminA, created.id, "archived");
    expect(archived.status).toBe("archived");
    const stillThere = await getPerformanceReview(scopeHrAdminA, created.id);
    expect(stillThere.id).toBe(created.id); // archived, not deleted

    const events = await prisma.auditEvent.findMany({ where: { tenantId: tenantA, entityId: created.id } });
    expect(events.some((e) => e.action === "PERFORMANCE_REVIEW_CREATED")).toBe(true);
    expect(events.some((e) => e.action === "PERFORMANCE_REVIEW_STATUS_CHANGED")).toBe(true);
  });

  it("reviewer validation: rejects self-review, a nonexistent reviewer, and a cross-school reviewer", async () => {
    await expect(
      createPerformanceReview(scopeHrAdminA, { staffId: staffA2, reviewerId: staffA2, reviewPeriodStart: "2026-01-01", reviewPeriodEnd: "2026-06-30" }),
    ).rejects.toThrow(HttpError);
    await expect(
      createPerformanceReview(scopeHrAdminA, { staffId: staffA2, reviewerId: "nonexistent", reviewPeriodStart: "2026-01-01", reviewPeriodEnd: "2026-06-30" }),
    ).rejects.toThrow(HttpError);
    await expect(
      createPerformanceReview(scopeHrAdminA, { staffId: staffA2, reviewerId: staffB1, reviewPeriodStart: "2026-01-01", reviewPeriodEnd: "2026-06-30" }),
    ).rejects.toThrow(HttpError);
  });

  it("rejects a review for a nonexistent or cross-school staffId", async () => {
    await expect(
      createPerformanceReview(scopeHrAdminA, { staffId: "nonexistent", reviewerId: staffA3, reviewPeriodStart: "2026-01-01", reviewPeriodEnd: "2026-06-30" }),
    ).rejects.toThrow(HttpError);
    await expect(
      createPerformanceReview(scopeHrAdminA, { staffId: staffB1, reviewerId: staffA3, reviewPeriodStart: "2026-01-01", reviewPeriodEnd: "2026-06-30" }),
    ).rejects.toThrow(HttpError);
  });

  it("rejects a review period end before the start", async () => {
    await expect(
      createPerformanceReview(scopeHrAdminA, { staffId: staffA2, reviewerId: staffA3, reviewPeriodStart: "2026-06-01", reviewPeriodEnd: "2026-01-01" }),
    ).rejects.toThrow();
  });

  it("School A / School B isolation: HR Admin B cannot read, update, or change status of School A's review", async () => {
    const review = await createPerformanceReview(scopeHrAdminA, { staffId: staffA2, reviewerId: staffA3, reviewPeriodStart: "2026-02-01", reviewPeriodEnd: "2026-07-31" });
    const listB = await listPerformanceReviews(scopeHrAdminB);
    expect(listB.some((r) => r.id === review.id)).toBe(false);
    await expect(getPerformanceReview(scopeHrAdminB, review.id)).rejects.toThrow(HttpError);
    await expect(updatePerformanceReview(scopeHrAdminB, review.id, { summary: "hijacked" })).rejects.toThrow(HttpError);
    await expect(setPerformanceReviewStatus(scopeHrAdminB, review.id, "archived")).rejects.toThrow(HttpError);
  });

  it("SCHOOL_ADMIN (hr.view) can read the full directory listing", async () => {
    const review = await createPerformanceReview(scopeHrAdminA, { staffId: staffA2, reviewerId: staffA3, reviewPeriodStart: "2026-03-01", reviewPeriodEnd: "2026-08-31" });
    const list = await listPerformanceReviews(scopeSchoolAdminA);
    expect(list.some((r) => r.id === review.id)).toBe(true);
  });

  it("self-service NEVER leaks a draft, in-review, or completed-but-not-visible review", async () => {
    const draft = await createPerformanceReview(scopeHrAdminA, { staffId: staffA1, reviewerId: staffA3, reviewPeriodStart: "2026-01-01", reviewPeriodEnd: "2026-06-30", visibleToEmployee: true });
    const inReview = await createPerformanceReview(scopeHrAdminA, { staffId: staffA1, reviewerId: staffA3, reviewPeriodStart: "2026-02-01", reviewPeriodEnd: "2026-07-31", visibleToEmployee: true });
    await setPerformanceReviewStatus(scopeHrAdminA, inReview.id, "in-review");
    const completedHidden = await createPerformanceReview(scopeHrAdminA, { staffId: staffA1, reviewerId: staffA3, reviewPeriodStart: "2026-03-01", reviewPeriodEnd: "2026-08-31", visibleToEmployee: false });
    await setPerformanceReviewStatus(scopeHrAdminA, completedHidden.id, "in-review");
    await setPerformanceReviewStatus(scopeHrAdminA, completedHidden.id, "completed");

    const ownView = await listMyPerformanceReviews(scopeTeacherA, staffA1);
    expect(ownView.some((r) => r.id === draft.id)).toBe(false); // still draft
    expect(ownView.some((r) => r.id === inReview.id)).toBe(false); // in-review, not completed
    expect(ownView.some((r) => r.id === completedHidden.id)).toBe(false); // completed but visibleToEmployee=false

    // Now genuinely complete + visible → self-service returns it.
    await setPerformanceReviewStatus(scopeHrAdminA, draft.id, "in-review");
    const completedVisible = await setPerformanceReviewStatus(scopeHrAdminA, draft.id, "completed");
    const ownViewAfter = await listMyPerformanceReviews(scopeTeacherA, staffA1);
    expect(ownViewAfter.some((r) => r.id === completedVisible.id)).toBe(true);
  });

  it("own-record access never leaks another employee's review", async () => {
    const other = await createPerformanceReview(scopeHrAdminA, { staffId: staffA2, reviewerId: staffA3, reviewPeriodStart: "2026-01-01", reviewPeriodEnd: "2026-06-30", visibleToEmployee: true });
    await setPerformanceReviewStatus(scopeHrAdminA, other.id, "in-review");
    await setPerformanceReviewStatus(scopeHrAdminA, other.id, "completed");
    const ownView = await listMyPerformanceReviews(scopeTeacherA, staffA1);
    expect(ownView.some((r) => r.id === other.id)).toBe(false);
  });

  it("invalid status value is rejected at the value-set level", () => {
    expect(PERFORMANCE_REVIEW_STATUS_VALUES).toContain("archived");
    expect(PERFORMANCE_REVIEW_STATUS_VALUES).not.toContain("bogus");
  });

  it("DTOs never leak tenantId/schoolId/branchId", async () => {
    const review = await createPerformanceReview(scopeHrAdminA, { staffId: staffA2, reviewerId: staffA3, reviewPeriodStart: "2026-01-01", reviewPeriodEnd: "2026-06-30" });
    const raw = JSON.stringify(review);
    expect(raw).not.toContain(tenantA);
    expect(raw).not.toContain(schoolA);
  });
});

describe.skipIf(!dbReady)("Training (DB)", () => {
  it("empty state: a fresh school has no training programs", async () => {
    const list = await listTrainingPrograms(scopeHrAdminB);
    expect(list).toEqual([]);
  });

  it("authorized create → update → assign → participant completion lifecycle", async () => {
    const program = await createTrainingProgram(scopeHrAdminA, { title: "Fire safety", category: "Safety", startDate: "2026-04-01", endDate: "2026-04-02" });
    expect(program.status).toBe("draft");
    expect(program.participantCount).toBe(0);

    const updated = await updateTrainingProgram(scopeHrAdminA, program.id, { trainerName: "Red Cross" });
    expect(updated.trainerName).toBe("Red Cross");

    const scheduled = await setTrainingProgramStatus(scopeHrAdminA, program.id, "scheduled");
    expect(scheduled.status).toBe("scheduled");

    const participant = await assignTrainingParticipant(scopeHrAdminA, program.id, { staffId: staffA2 });
    expect(participant.status).toBe("assigned");
    expect(participant.staffId).toBe(staffA2);

    const inProgress = await setTrainingParticipantStatus(scopeHrAdminA, participant.id, { status: "in-progress" });
    expect(inProgress.status).toBe("in-progress");
    const completed = await setTrainingParticipantStatus(scopeHrAdminA, participant.id, { status: "completed", certificateIssued: true });
    expect(completed.status).toBe("completed");
    expect(completed.completedAt).not.toBeNull();
    expect(completed.certificateIssued).toBe(true);

    const afterAssign = await getTrainingProgram(scopeHrAdminA, program.id);
    expect(afterAssign.participantCount).toBe(1);

    const events = await prisma.auditEvent.findMany({ where: { tenantId: tenantA, entityId: program.id } });
    expect(events.some((e) => e.action === "TRAINING_PROGRAM_CREATED")).toBe(true);
    const participantEvents = await prisma.auditEvent.findMany({ where: { tenantId: tenantA, entityId: participant.id } });
    expect(participantEvents.some((e) => e.action === "TRAINING_PARTICIPANT_ASSIGNED")).toBe(true);
    expect(participantEvents.some((e) => e.action === "TRAINING_PARTICIPANT_STATUS_CHANGED")).toBe(true);
  });

  it("program lifecycle: cancel and archive (delete-equivalent, never hard-deleted)", async () => {
    const program = await createTrainingProgram(scopeHrAdminA, { title: "Cancel me", startDate: "2026-05-01" });
    const cancelled = await setTrainingProgramStatus(scopeHrAdminA, program.id, "cancelled");
    expect(cancelled.status).toBe("cancelled");
    const archived = await setTrainingProgramStatus(scopeHrAdminA, program.id, "archived");
    expect(archived.status).toBe("archived");
    const stillThere = await getTrainingProgram(scopeHrAdminA, program.id);
    expect(stillThere.id).toBe(program.id);
  });

  it("rejects assigning a nonexistent or cross-school employee, and rejects a duplicate assignment", async () => {
    const program = await createTrainingProgram(scopeHrAdminA, { title: "Assignment guard", startDate: "2026-05-01" });
    await expect(assignTrainingParticipant(scopeHrAdminA, program.id, { staffId: "nonexistent" })).rejects.toThrow(HttpError);
    await expect(assignTrainingParticipant(scopeHrAdminA, program.id, { staffId: staffB1 })).rejects.toThrow(HttpError);
    await assignTrainingParticipant(scopeHrAdminA, program.id, { staffId: staffA2 });
    await expect(assignTrainingParticipant(scopeHrAdminA, program.id, { staffId: staffA2 })).rejects.toThrow(HttpError);
  });

  it("School A / School B isolation: HR Admin B cannot read/update/assign/change-status on School A's program", async () => {
    const program = await createTrainingProgram(scopeHrAdminA, { title: "Isolated program", startDate: "2026-06-01" });
    const listB = await listTrainingPrograms(scopeHrAdminB);
    expect(listB.some((p) => p.id === program.id)).toBe(false);
    await expect(getTrainingProgram(scopeHrAdminB, program.id)).rejects.toThrow(HttpError);
    await expect(updateTrainingProgram(scopeHrAdminB, program.id, { title: "hijacked" })).rejects.toThrow(HttpError);
    await expect(setTrainingProgramStatus(scopeHrAdminB, program.id, "archived")).rejects.toThrow(HttpError);
    await expect(assignTrainingParticipant(scopeHrAdminB, program.id, { staffId: staffB1 })).rejects.toThrow(HttpError);
  });

  it("self-service shows only the caller's own training assignments", async () => {
    const program = await createTrainingProgram(scopeHrAdminA, { title: "My training", startDate: "2026-07-01" });
    await assignTrainingParticipant(scopeHrAdminA, program.id, { staffId: staffA1 });
    const otherProgram = await createTrainingProgram(scopeHrAdminA, { title: "Someone else's training", startDate: "2026-07-01" });
    await assignTrainingParticipant(scopeHrAdminA, otherProgram.id, { staffId: staffA2 });

    const ownView = await listMyTrainingAssignments(scopeTeacherA, staffA1);
    expect(ownView.some((a) => a.title === "My training")).toBe(true);
    expect(ownView.some((a) => a.title === "Someone else's training")).toBe(false);
  });

  it("listTrainingParticipants scopes to the given program only", async () => {
    const programOne = await createTrainingProgram(scopeHrAdminA, { title: "Program one", startDate: "2026-08-01" });
    const programTwo = await createTrainingProgram(scopeHrAdminA, { title: "Program two", startDate: "2026-08-01" });
    await assignTrainingParticipant(scopeHrAdminA, programOne.id, { staffId: staffA2 });
    await assignTrainingParticipant(scopeHrAdminA, programTwo.id, { staffId: staffA3 });
    const participantsOne = await listTrainingParticipants(scopeHrAdminA, programOne.id);
    expect(participantsOne.length).toBe(1);
    expect(participantsOne[0].staffId).toBe(staffA2);
  });

  it("invalid status value is rejected at the value-set level", () => {
    expect(TRAINING_PROGRAM_STATUS_VALUES).toContain("archived");
    expect(TRAINING_PROGRAM_STATUS_VALUES).not.toContain("bogus");
  });

  it("DTOs never leak tenantId/schoolId/branchId", async () => {
    const program = await createTrainingProgram(scopeHrAdminA, { title: "DTO check", startDate: "2026-09-01" });
    const raw = JSON.stringify(program);
    expect(raw).not.toContain(tenantA);
    expect(raw).not.toContain(schoolA);
  });
});

describe.skipIf(!dbReady)("Employee Self Service — real caller-scoped Performance/Training (DB)", () => {
  it("returns only completed+visible reviews and own training assignments, resolved server-side from Staff.userId", async () => {
    const draftReview = await createPerformanceReview(scopeHrAdminA, { staffId: staffA1, reviewerId: staffA3, reviewPeriodStart: "2026-01-01", reviewPeriodEnd: "2026-06-30", visibleToEmployee: true });
    const program = await createTrainingProgram(scopeHrAdminA, { title: "Self-service training", startDate: "2026-10-01" });
    await assignTrainingParticipant(scopeHrAdminA, program.id, { staffId: staffA1 });

    const summary = await getMySelfService(scopeTeacherA);
    expect(summary.staff.id).toBe(staffA1);
    expect(summary.performanceReviews.some((r) => r.id === draftReview.id)).toBe(false); // still draft
    expect(summary.trainingAssignments.some((t) => t.title === "Self-service training")).toBe(true);

    await setPerformanceReviewStatus(scopeHrAdminA, draftReview.id, "in-review");
    await setPerformanceReviewStatus(scopeHrAdminA, draftReview.id, "completed");
    const summaryAfter = await getMySelfService(scopeTeacherA);
    expect(summaryAfter.performanceReviews.some((r) => r.id === draftReview.id)).toBe(true);
  });
});
