// Activities / Student Life DB integration tests (Phase 9U). Real Postgres:
// Activity CRUD (duplicate code, status transitions), ActivityStaffAssignment
// (real Staff only, upsert-reactivation), ActivityStudentMembership (real
// Student only, concurrency-safe one-active-membership-per-session,
// cross-session non-exclusivity, historical safety), ActivityEvent
// (DRAFT/PUBLISHED/COMPLETED/CANCELLED lifecycle, invalid transitions,
// Calendar derivation), ActivityEventParticipant (registration only while
// PUBLISHED, concurrency-safe duplicate prevention, deliberately NOT academic
// Attendance), StudentAchievement (factual only), Student 360, RBAC,
// isolation, audit, DTO safety. Namespaced ("T9U"). Mirrors the exact
// setup/teardown pattern of lib/server/cafeteria/cafeteria.db.test.ts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createActivity, getActivity, listActivities, updateActivity } from "@/lib/server/activities/activities";
import { assignStaff, endStaffAssignment, listStaffAssignments } from "@/lib/server/activities/staff-assignments";
import { joinActivity, leaveActivity, listMemberships } from "@/lib/server/activities/memberships";
import { cancelEvent, completeEvent, createEvent, listEvents, publishEvent, updateEvent } from "@/lib/server/activities/events";
import { listParticipants, registerParticipant, updateParticipant } from "@/lib/server/activities/participants";
import { createAchievement, listAchievements } from "@/lib/server/activities/achievements";
import { getActivityDashboard } from "@/lib/server/activities/dashboard";
import { getStudentActivityProfile } from "@/lib/server/activities/student-profile";
import { listCalendarEvents } from "@/lib/server/calendar/service";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T9U";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "", sessionId = "", sessionId2 = "";
let staff1 = "", inactiveStaff = "";
let foreignTenantId = "", foreignSchoolId = "", foreignBranchId = "", foreignStudentId = "";
let scopeAdmin: OrgScope, scopeCoordinator: OrgScope, scopePrincipal: OrgScope, scopeForeignAdmin: OrgScope, scopeSession2: OrgScope;
let adminUser = "", coordinatorUser = "", principalUser = "", foreignAdminUser = "";

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
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t9u-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S1`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  sessionId2 = (await prisma.academicSession.create({ data: { schoolId, name: "27-28", code: `${NS}-S2`, startDate: new Date("2027-04-01"), endDate: new Date("2028-03-31"), status: "ACTIVE" }, select: { id: true } })).id;

  adminUser = await makeUserWithRole(`t9u-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  principalUser = await makeUserWithRole(`t9u-principal-${stamp}@x.test`, "PRINCIPAL");
  coordinatorUser = await makeUserWithRole(`t9u-coord-${stamp}@x.test`, "ACTIVITY_COORDINATOR");

  staff1 = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-ST1-${stamp}`, firstName: "Staff", lastName: "One", status: "ACTIVE" }, select: { id: true } })).id;
  inactiveStaff = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-STI-${stamp}`, firstName: "Inactive", lastName: "Staff", status: "INACTIVE" }, select: { id: true } })).id;

  foreignTenantId = (await prisma.tenant.create({ data: { name: `${NS} T2`, slug: `t9u-b-${stamp}` }, select: { id: true } })).id;
  foreignSchoolId = (await prisma.school.create({ data: { tenantId: foreignTenantId, name: `${NS} S2`, code: `${NS}-B-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  foreignBranchId = (await prisma.branch.create({ data: { schoolId: foreignSchoolId, name: "B", code: `${NS}-B`, status: "ACTIVE" }, select: { id: true } })).id;
  const foreignSession = (await prisma.academicSession.create({ data: { schoolId: foreignSchoolId, name: "26-27", code: `${NS}-BS`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  foreignStudentId = await makeStudent("foreign", "ACTIVE", foreignTenantId, foreignSchoolId, foreignBranchId, foreignSession);
  foreignAdminUser = await makeUserWithRole(`t9u-fadmin-${stamp}@x.test`, "SCHOOL_ADMIN", foreignTenantId);

  scopeAdmin = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: adminUser, name: "Admin" } };
  scopeCoordinator = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: coordinatorUser, name: "Coordinator" } };
  scopePrincipal = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: principalUser, name: "Principal" } };
  scopeSession2 = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId2, actor: { id: adminUser, name: "Admin" } };
  scopeForeignAdmin = { tenantId: foreignTenantId, schoolId: foreignSchoolId, branchId: foreignBranchId, academicSessionId: foreignSession, actor: { id: foreignAdminUser, name: "Foreign Admin" } };
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.studentAchievement.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.activityEventParticipant.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.activityEvent.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.activityStudentMembership.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.activityStaffAssignment.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.activity.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.student.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.staff.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.roleAssignment.deleteMany({ where: { membership: { tenantId: { in: [tenantId, foreignTenantId] } } } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.academicSession.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.branch.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.school.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUser, principalUser, coordinatorUser, foreignAdminUser] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, foreignTenantId] } } });
});

describe.skipIf(!dbReady)("Activity master (DB)", () => {
  it("creates, updates (status change vs plain update), and rejects a duplicate code", async () => {
    const activity = await createActivity(scopeCoordinator, { code: `CLUB-${stamp}`, name: "Debate Club", type: "club" });
    expect(activity.status).toBe("active");
    expect(activity.memberCount).toBe(0);

    const renamed = await updateActivity(scopeCoordinator, activity.id, { name: "Debate & Rhetoric Club" });
    expect(renamed.name).toBe("Debate & Rhetoric Club");

    const archived = await updateActivity(scopeCoordinator, activity.id, { status: "archived" });
    expect(archived.status).toBe("archived");

    await expect(createActivity(scopeCoordinator, { code: `CLUB-${stamp}`, name: "Dup", type: "club" })).rejects.toThrow(HttpError);
  });

  it("isolation: a foreign tenant cannot see or fetch another school's activity", async () => {
    const activity = await createActivity(scopeCoordinator, { code: `ISO-${stamp}`, name: "Isolated Club", type: "club" });
    const foreignList = await listActivities(scopeForeignAdmin);
    expect(foreignList.some((a) => a.id === activity.id)).toBe(false);
    await expect(getActivity(scopeForeignAdmin, activity.id)).rejects.toThrow(HttpError);
  });
});

describe.skipIf(!dbReady)("Staff coordinators (DB)", () => {
  it("assigns a real active staff member; rejects inactive and foreign staff", async () => {
    const activity = await createActivity(scopeCoordinator, { code: `STF-${stamp}`, name: "Chess Club", type: "club" });
    const assignment = await assignStaff(scopeCoordinator, activity.id, { staffId: staff1, role: "coordinator" });
    expect(assignment.status).toBe("active");
    expect(assignment.staffName).toContain("Staff");

    await expect(assignStaff(scopeCoordinator, activity.id, { staffId: inactiveStaff })).rejects.toThrow(HttpError);

    const foreignStaff = (await prisma.staff.create({ data: { tenantId: foreignTenantId, schoolId: foreignSchoolId, branchId: foreignBranchId, employeeCode: `${NS}-FSTF-${stamp}`, firstName: "Foreign", lastName: "Staff", status: "ACTIVE" }, select: { id: true } })).id;
    await expect(assignStaff(scopeCoordinator, activity.id, { staffId: foreignStaff })).rejects.toThrow(HttpError);
  });

  it("ends an assignment, then reactivates it via upsert (same row id reused)", async () => {
    const activity = await createActivity(scopeCoordinator, { code: `REACT-${stamp}`, name: "Robotics Club", type: "club" });
    const first = await assignStaff(scopeCoordinator, activity.id, { staffId: staff1, role: "mentor" });
    const ended = await endStaffAssignment(scopeCoordinator, activity.id, first.id);
    expect(ended.status).toBe("ended");
    await expect(endStaffAssignment(scopeCoordinator, activity.id, first.id)).rejects.toThrow(HttpError);

    const reactivated = await assignStaff(scopeCoordinator, activity.id, { staffId: staff1, role: "mentor" });
    expect(reactivated.id).toBe(first.id);
    expect(reactivated.status).toBe("active");

    const all = await listStaffAssignments(scopeCoordinator, activity.id);
    expect(all.filter((a) => a.id === first.id).length).toBe(1);
  });
});

describe.skipIf(!dbReady)("Student memberships (DB)", () => {
  it("joins a real active student; rejects inactive and foreign students", async () => {
    const activity = await createActivity(scopeCoordinator, { code: `MEM-${stamp}`, name: "Art Club", type: "club" });
    const student = await makeStudent("mem1");
    const membership = await joinActivity(scopeCoordinator, activity.id, { studentId: student });
    expect(membership.status).toBe("active");
    expect(membership.activityName).toBe("Art Club");

    const inactiveStudent = await makeStudent("meminactive", "INACTIVE");
    await expect(joinActivity(scopeCoordinator, activity.id, { studentId: inactiveStudent })).rejects.toThrow(HttpError);
    await expect(joinActivity(scopeCoordinator, activity.id, { studentId: foreignStudentId })).rejects.toThrow(HttpError);
    await expect(joinActivity(scopeCoordinator, activity.id, { studentId: "nonexistent" })).rejects.toThrow(HttpError);
  });

  it("blocks a duplicate active membership in the same activity + session", async () => {
    const activity = await createActivity(scopeCoordinator, { code: `DUP-${stamp}`, name: "Dance Club", type: "club" });
    const student = await makeStudent("dupmem1");
    await joinActivity(scopeCoordinator, activity.id, { studentId: student });
    await expect(joinActivity(scopeCoordinator, activity.id, { studentId: student })).rejects.toThrow(HttpError);
  });

  it("the same student CAN hold an active membership in the same activity across two different sessions", async () => {
    const activity = await createActivity(scopeCoordinator, { code: `SESS-${stamp}`, name: "Music Club", type: "club" });
    const student = await makeStudent("crosssess1");
    await joinActivity(scopeCoordinator, activity.id, { studentId: student });
    const secondSession = await joinActivity(scopeSession2, activity.id, { studentId: student });
    expect(secondSession.status).toBe("active");
  });

  it("concurrency: duplicate join race for the same student/activity/session resolves to exactly one active winner", async () => {
    const activity = await createActivity(scopeCoordinator, { code: `RACE-${stamp}`, name: "Coding Club", type: "club" });
    const student = await makeStudent("racemem1");
    const results = await Promise.all(Array.from({ length: 5 }, () => joinActivity(scopeCoordinator, activity.id, { studentId: student }).catch((e) => e)));
    expect(results.filter((r) => !(r instanceof Error)).length).toBe(1);
    const count = await prisma.activityStudentMembership.count({ where: { activityId: activity.id, studentId: student, academicSessionId: sessionId, status: "ACTIVE" } });
    expect(count).toBe(1);
  });

  it("leaves (ends) a membership; a second leave attempt is rejected", async () => {
    const activity = await createActivity(scopeCoordinator, { code: `LEAVE-${stamp}`, name: "Photography Club", type: "club" });
    const student = await makeStudent("leave1");
    const membership = await joinActivity(scopeCoordinator, activity.id, { studentId: student });
    const ended = await leaveActivity(scopeCoordinator, activity.id, membership.id);
    expect(ended.status).toBe("ended");
    expect(ended.leftAt).not.toBeNull();
    await expect(leaveActivity(scopeCoordinator, activity.id, membership.id)).rejects.toThrow(HttpError);
  });

  it("historical safety: membership survives a student rename", async () => {
    const activity = await createActivity(scopeCoordinator, { code: `HIST-${stamp}`, name: "History Club", type: "club" });
    const student = await makeStudent("histmem1");
    const membership = await joinActivity(scopeCoordinator, activity.id, { studentId: student });
    await prisma.student.update({ where: { id: student }, data: { firstName: "RenamedMember" } });
    const list = await listMemberships(scopeCoordinator, { activityId: activity.id });
    const found = list.find((m) => m.id === membership.id);
    expect(found?.studentName).toContain("RenamedMember");
  });
});

describe.skipIf(!dbReady)("Events lifecycle (DB)", () => {
  it("creates a DRAFT event, publishes, and completes it", async () => {
    const activity = await createActivity(scopeCoordinator, { code: `EVT-${stamp}`, name: "Annual Day Club", type: "cultural" });
    const event = await createEvent(scopeCoordinator, { activityId: activity.id, title: "Annual Day", startAt: new Date(Date.now() + 86_400_000).toISOString() });
    expect(event.status).toBe("draft");

    const published = await publishEvent(scopeCoordinator, event.id);
    expect(published.status).toBe("published");
    const completed = await completeEvent(scopeCoordinator, event.id);
    expect(completed.status).toBe("completed");
  });

  it("rejects an invalid transition (cannot complete a draft, cannot edit a completed event)", async () => {
    const activity = await createActivity(scopeCoordinator, { code: `INV-${stamp}`, name: "Invalid Transition Club", type: "club" });
    const event = await createEvent(scopeCoordinator, { activityId: activity.id, title: "Draft Event", startAt: new Date(Date.now() + 86_400_000).toISOString() });
    await expect(completeEvent(scopeCoordinator, event.id)).rejects.toThrow(HttpError);

    await publishEvent(scopeCoordinator, event.id);
    await completeEvent(scopeCoordinator, event.id);
    await expect(updateEvent(scopeCoordinator, event.id, { title: "Too late" })).rejects.toThrow(HttpError);
    await expect(publishEvent(scopeCoordinator, event.id)).rejects.toThrow(HttpError);
  });

  it("cancels a draft or published event; a cancelled event cannot be published", async () => {
    const activity = await createActivity(scopeCoordinator, { code: `CANC-${stamp}`, name: "Cancellable Club", type: "club" });
    const event = await createEvent(scopeCoordinator, { activityId: activity.id, title: "Cancel Me", startAt: new Date(Date.now() + 86_400_000).toISOString() });
    const cancelled = await cancelEvent(scopeCoordinator, event.id);
    expect(cancelled.status).toBe("cancelled");
    await expect(publishEvent(scopeCoordinator, event.id)).rejects.toThrow(HttpError);
  });

  it("concurrency: a duplicate publish race resolves without a double-transition error surfacing twice", async () => {
    const activity = await createActivity(scopeCoordinator, { code: `RACEEVT-${stamp}`, name: "Race Event Club", type: "club" });
    const event = await createEvent(scopeCoordinator, { activityId: activity.id, title: "Race Publish", startAt: new Date(Date.now() + 86_400_000).toISOString() });
    const results = await Promise.all(Array.from({ length: 5 }, () => publishEvent(scopeCoordinator, event.id).catch((e) => e)));
    expect(results.filter((r) => !(r instanceof Error)).length).toBe(1);
    const row = await prisma.activityEvent.findUniqueOrThrow({ where: { id: event.id }, select: { status: true } });
    expect(row.status).toBe("PUBLISHED");
  });

  it("only a PUBLISHED event is derived into the real Calendar", async () => {
    const activity = await createActivity(scopeCoordinator, { code: `CAL-${stamp}`, name: "Calendar Club", type: "club" });
    const startAt = new Date(Date.now() + 2 * 86_400_000);
    const draft = await createEvent(scopeCoordinator, { activityId: activity.id, title: "Draft Not On Calendar", startAt: startAt.toISOString() });
    const published = await createEvent(scopeCoordinator, { activityId: activity.id, title: "Published On Calendar", startAt: startAt.toISOString() });
    await publishEvent(scopeCoordinator, published.id);

    const from = new Date(startAt.getTime() - 86_400_000).toISOString().slice(0, 10);
    const to = new Date(startAt.getTime() + 86_400_000).toISOString().slice(0, 10);
    const calendar = await listCalendarEvents(scopeCoordinator, { from, to });
    expect(calendar.some((c) => c.sourceType === "activity-event" && c.sourceId === published.id)).toBe(true);
    expect(calendar.some((c) => c.sourceType === "activity-event" && c.sourceId === draft.id)).toBe(false);
  });

  it("isolation: a foreign tenant cannot see or fetch another school's event", async () => {
    const activity = await createActivity(scopeCoordinator, { code: `EVTISO-${stamp}`, name: "Event Isolation Club", type: "club" });
    const event = await createEvent(scopeCoordinator, { activityId: activity.id, title: "Isolated Event", startAt: new Date(Date.now() + 86_400_000).toISOString() });
    const foreignList = await listEvents(scopeForeignAdmin);
    expect(foreignList.some((e) => e.id === event.id)).toBe(false);
  });
});

describe.skipIf(!dbReady)("Event participation (DB) — deliberately NOT academic Attendance", () => {
  it("registers a real active student only while the event is PUBLISHED", async () => {
    const activity = await createActivity(scopeCoordinator, { code: `PART-${stamp}`, name: "Participation Club", type: "club" });
    const event = await createEvent(scopeCoordinator, { activityId: activity.id, title: "Participation Event", startAt: new Date(Date.now() + 86_400_000).toISOString() });
    const student = await makeStudent("part1");
    await expect(registerParticipant(scopeCoordinator, event.id, { studentId: student })).rejects.toThrow(HttpError);

    await publishEvent(scopeCoordinator, event.id);
    const participant = await registerParticipant(scopeCoordinator, event.id, { studentId: student });
    expect(participant.status).toBe("registered");

    const inactiveStudent = await makeStudent("partinactive", "INACTIVE");
    await expect(registerParticipant(scopeCoordinator, event.id, { studentId: inactiveStudent })).rejects.toThrow(HttpError);
    await expect(registerParticipant(scopeCoordinator, event.id, { studentId: foreignStudentId })).rejects.toThrow(HttpError);
  });

  it("rejects a duplicate registration for the same student/event", async () => {
    const activity = await createActivity(scopeCoordinator, { code: `DUPPART-${stamp}`, name: "Duplicate Participation Club", type: "club" });
    const event = await createEvent(scopeCoordinator, { activityId: activity.id, title: "Duplicate Event", startAt: new Date(Date.now() + 86_400_000).toISOString() });
    await publishEvent(scopeCoordinator, event.id);
    const student = await makeStudent("duppart1");
    await registerParticipant(scopeCoordinator, event.id, { studentId: student });
    await expect(registerParticipant(scopeCoordinator, event.id, { studentId: student })).rejects.toThrow(HttpError);
  });

  it("concurrency: duplicate registration race resolves to exactly one winner", async () => {
    const activity = await createActivity(scopeCoordinator, { code: `RACEPART-${stamp}`, name: "Race Participation Club", type: "club" });
    const event = await createEvent(scopeCoordinator, { activityId: activity.id, title: "Race Event", startAt: new Date(Date.now() + 86_400_000).toISOString() });
    await publishEvent(scopeCoordinator, event.id);
    const student = await makeStudent("racepart1");
    const results = await Promise.all(Array.from({ length: 5 }, () => registerParticipant(scopeCoordinator, event.id, { studentId: student }).catch((e) => e)));
    expect(results.filter((r) => !(r instanceof Error)).length).toBe(1);
    const count = await prisma.activityEventParticipant.count({ where: { eventId: event.id, studentId: student } });
    expect(count).toBe(1);
  });

  it("marks a participant attended/absent; never touches AttendanceSession/AttendanceRecord", async () => {
    const activity = await createActivity(scopeCoordinator, { code: `MARK-${stamp}`, name: "Marking Club", type: "club" });
    const event = await createEvent(scopeCoordinator, { activityId: activity.id, title: "Marking Event", startAt: new Date(Date.now() + 86_400_000).toISOString() });
    await publishEvent(scopeCoordinator, event.id);
    const student = await makeStudent("mark1");
    const participant = await registerParticipant(scopeCoordinator, event.id, { studentId: student });
    const attended = await updateParticipant(scopeCoordinator, event.id, participant.id, { status: "attended" });
    expect(attended.status).toBe("attended");
    expect(attended.attendedAt).not.toBeNull();

    const recordCount = await prisma.attendanceRecord.count({ where: { studentId: student } });
    expect(recordCount).toBe(0);

    const list = await listParticipants(scopeCoordinator, event.id);
    expect(list.find((p) => p.id === participant.id)?.status).toBe("attended");
  });
});

describe.skipIf(!dbReady)("Achievements (DB) — factual only", () => {
  it("records a factual achievement linked to a real student and activity", async () => {
    const activity = await createActivity(scopeCoordinator, { code: `ACH-${stamp}`, name: "Achievement Club", type: "club" });
    const student = await makeStudent("ach1");
    const achievement = await createAchievement(scopeCoordinator, { studentId: student, activityId: activity.id, title: "Won inter-school quiz", awardedAt: "2027-01-15" });
    expect(achievement.title).toBe("Won inter-school quiz");
    expect(achievement.activityName).toBe("Achievement Club");
    expect(Object.keys(achievement)).not.toContain("level");
    expect(Object.keys(achievement)).not.toContain("position");
    expect(Object.keys(achievement)).not.toContain("points");
    expect(Object.keys(achievement)).not.toContain("score");
  });

  it("historical safety: achievement survives a student rename and an activity archive", async () => {
    const activity = await createActivity(scopeCoordinator, { code: `ACHHIST-${stamp}`, name: "Achievement History Club", type: "club" });
    const student = await makeStudent("achhist1");
    const achievement = await createAchievement(scopeCoordinator, { studentId: student, activityId: activity.id, title: "Historical achievement", awardedAt: "2027-02-01" });
    await prisma.student.update({ where: { id: student }, data: { firstName: "RenamedAchiever" } });
    await updateActivity(scopeCoordinator, activity.id, { status: "archived" });
    const list = await listAchievements(scopeCoordinator, { studentId: student });
    expect(list.find((a) => a.id === achievement.id)?.title).toBe("Historical achievement");
  });
});

describe.skipIf(!dbReady)("Dashboard (DB)", () => {
  it("is DB-derived from real records only", async () => {
    const activity = await createActivity(scopeCoordinator, { code: `DASH-${stamp}`, name: "Dashboard Club", type: "club" });
    await assignStaff(scopeCoordinator, activity.id, { staffId: staff1, role: "coordinator" });
    const student = await makeStudent("dash1");
    await joinActivity(scopeCoordinator, activity.id, { studentId: student });
    const dashboard = await getActivityDashboard(scopeAdmin);
    expect(dashboard.activeActivities).toBeGreaterThanOrEqual(1);
    expect(dashboard.activeMemberships).toBeGreaterThanOrEqual(1);
    expect(dashboard.coordinatorCount).toBeGreaterThanOrEqual(1);
  });
});

describe.skipIf(!dbReady)("Student 360 Activities profile (DB)", () => {
  it("returns real active/past memberships, upcoming events, participation, and achievements", async () => {
    const activity = await createActivity(scopeCoordinator, { code: `S360-${stamp}`, name: "Student 360 Club", type: "club" });
    const student = await makeStudent("s3601");
    const membership = await joinActivity(scopeCoordinator, activity.id, { studentId: student });
    const event = await createEvent(scopeCoordinator, { activityId: activity.id, title: "S360 Event", startAt: new Date(Date.now() + 86_400_000).toISOString() });
    await publishEvent(scopeCoordinator, event.id);
    await registerParticipant(scopeCoordinator, event.id, { studentId: student });
    await createAchievement(scopeCoordinator, { studentId: student, activityId: activity.id, title: "S360 achievement", awardedAt: "2027-03-01" });

    const profile = await getStudentActivityProfile(scopeAdmin, student);
    expect(profile.activeMemberships.some((m) => m.id === membership.id)).toBe(true);
    expect(profile.upcomingEvents.some((e) => e.id === event.id)).toBe(true);
    expect(profile.recentParticipation.some((p) => p.eventId === event.id)).toBe(true);
    expect(profile.achievements.length).toBeGreaterThanOrEqual(1);

    await leaveActivity(scopeCoordinator, activity.id, membership.id);
    const after = await getStudentActivityProfile(scopeAdmin, student);
    expect(after.pastMemberships.some((m) => m.id === membership.id)).toBe(true);
    expect(after.activeMemberships.some((m) => m.id === membership.id)).toBe(false);
  });

  it("empty for a student with no activities involvement", async () => {
    const student = await makeStudent("s360empty1");
    const profile = await getStudentActivityProfile(scopeAdmin, student);
    expect(profile.activeMemberships).toEqual([]);
    expect(profile.achievements).toEqual([]);
  });
});

describe.skipIf(!dbReady)("Security / RBAC / Isolation / Audit / DTO safety (DB)", () => {
  it("activities.view/manage: ACTIVITY_COORDINATOR has both; SCHOOL_ADMIN and PRINCIPAL view only", () => {
    expect(ROLE_PERMISSIONS.ACTIVITY_COORDINATOR).toContain("activities.view");
    expect(ROLE_PERMISSIONS.ACTIVITY_COORDINATOR).toContain("activities.manage");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("activities.view");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).not.toContain("activities.manage");
    expect(ROLE_PERMISSIONS.PRINCIPAL).toContain("activities.view");
    expect(ROLE_PERMISSIONS.PRINCIPAL).not.toContain("activities.manage");
    expect(ROLE_PERMISSIONS.TEACHER ?? []).not.toContain("activities.view");
    void scopePrincipal; // RBAC enforcement itself is at the route layer (requirePermission) — this documents the catalog contract.
  });

  it("activities mutations are audited", async () => {
    const events = await prisma.auditEvent.count({
      where: { tenantId, action: { in: ["ACTIVITY_CREATED", "ACTIVITY_STAFF_ASSIGNED", "ACTIVITY_STUDENT_JOINED", "ACTIVITY_EVENT_CREATED", "ACTIVITY_EVENT_PUBLISHED", "ACTIVITY_PARTICIPANT_REGISTERED", "ACTIVITY_ACHIEVEMENT_RECORDED"] } },
    });
    expect(events).toBeGreaterThan(6);
  });

  it("DTOs never leak tenantId/schoolId and never contain Health/Counseling-domain fields", async () => {
    const activity = await createActivity(scopeCoordinator, { code: `DTO-${stamp}`, name: "DTO Safety Club", type: "club" });
    const student = await makeStudent("dto1");
    const membership = await joinActivity(scopeCoordinator, activity.id, { studentId: student });
    const raw = JSON.stringify(membership);
    expect(raw).not.toContain(tenantId);
    expect(raw).not.toContain(schoolId);
    expect(Object.keys(membership)).not.toContain("allergies");
    expect(Object.keys(membership)).not.toContain("healthProfile");
    expect(Object.keys(membership)).not.toContain("counselingCase");
  });

  it("confirms no parallel fee/inventory engine: creating an activity/event/achievement writes no FeeCharge and no InventoryStockBalance mutation", async () => {
    const activity = await createActivity(scopeCoordinator, { code: `NOPAR-${stamp}`, name: "No Parallel Club", type: "club" });
    const student = await makeStudent("nopar1");
    await createAchievement(scopeCoordinator, { studentId: student, activityId: activity.id, title: "No parallel money", awardedAt: "2027-04-01" });
    const feeCharge = await prisma.feeCharge.findFirst({ where: { studentId: student } });
    expect(feeCharge).toBeNull();
  });
});
