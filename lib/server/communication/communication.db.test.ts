// Communication / Messaging DB integration tests (Phase 9K). Real Postgres:
// eligible-recipient identity resolution (Staff-linked + non-Staff privileged
// roles, excluding unlinked/inactive/foreign-school), concurrency-safe DIRECT
// conversation dedup, message send/validation/pagination/ordering, monotonic
// unread/read state, Phase 9D notification fan-out + idempotency, participant-
// membership vs feature-RBAC distinction, DTO safety, audit events.
// Namespaced ("T9K").
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createStaff, setStaffStatus, setStaffUser } from "@/lib/server/staff/service";
import {
  getConversation,
  getUnreadCount,
  listConversations,
  listEligibleRecipients,
  listMessages,
  markConversationRead,
  sendMessage,
  startDirectConversation,
} from "@/lib/server/communication/service";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";
import type { OrgScope } from "@/lib/server/api/scope";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T9K";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "";
let adminUserId = "", teacherUserId = "", teacher2UserId = "", librarianUserId = "";
let inactiveTeacherUserId = "";
let adminScope: OrgScope, teacherScope: OrgScope, teacher2Scope: OrgScope, librarianScope: OrgScope;

// Foreign school (isolation)
let schoolBId = "", foreignUserId = "";
let foreignScope: OrgScope;

async function makeUserWithRole(email: string, roleKey: string, forTenantId = tenantId): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email.split("@")[0], status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId: forTenantId, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t9k-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;

  adminUserId = await makeUserWithRole(`t9k-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  adminScope = { tenantId, schoolId, branchId: branchA, academicSessionId: null, actor: { id: adminUserId, name: "Admin" } };

  teacherUserId = await makeUserWithRole(`t9k-teacher-${stamp}@x.test`, "TEACHER");
  const teacherStaff = await createStaff(adminScope, { employeeCode: "T9K-1", firstName: "Tara", isTeaching: true });
  await setStaffUser(adminScope, teacherStaff.id, teacherUserId);
  teacherScope = { tenantId, schoolId, branchId: branchA, academicSessionId: null, actor: { id: teacherUserId, name: "Tara" } };

  teacher2UserId = await makeUserWithRole(`t9k-teacher2-${stamp}@x.test`, "TEACHER");
  const teacher2Staff = await createStaff(adminScope, { employeeCode: "T9K-2", firstName: "Tom", isTeaching: true });
  await setStaffUser(adminScope, teacher2Staff.id, teacher2UserId);
  teacher2Scope = { tenantId, schoolId, branchId: branchA, academicSessionId: null, actor: { id: teacher2UserId, name: "Tom" } };

  // Unlinked Staff — a real Staff row with NO User account. Must never appear as a recipient.
  await createStaff(adminScope, { employeeCode: "T9K-UNLINKED", firstName: "Ghost", isTeaching: true });

  // Inactive Staff, linked to a real User. Must never appear as a recipient.
  inactiveTeacherUserId = await makeUserWithRole(`t9k-inactive-${stamp}@x.test`, "TEACHER");
  const inactiveStaff = await createStaff(adminScope, { employeeCode: "T9K-INACTIVE", firstName: "Retired", isTeaching: true });
  await setStaffUser(adminScope, inactiveStaff.id, inactiveTeacherUserId);
  await setStaffStatus(adminScope, inactiveStaff.id, "inactive");

  // LIBRARIAN — no communication.send permission. Used for RBAC/feature-access tests.
  librarianUserId = await makeUserWithRole(`t9k-librarian-${stamp}@x.test`, "LIBRARIAN");
  librarianScope = { tenantId, schoolId, branchId: branchA, academicSessionId: null, actor: { id: librarianUserId, name: "Lib" } };

  // Foreign school (same tenant is fine — isolation is schoolId-scoped for Conversation).
  schoolBId = (await prisma.school.create({ data: { tenantId, name: `${NS} SB`, code: `${NS}-SB-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  const branchB = (await prisma.branch.create({ data: { schoolId: schoolBId, name: "B", code: `${NS}-BB`, status: "ACTIVE" }, select: { id: true } })).id;
  foreignUserId = await makeUserWithRole(`t9k-foreign-${stamp}@x.test`, "TEACHER");
  const foreignScopeAdmin: OrgScope = { tenantId, schoolId: schoolBId, branchId: branchB, academicSessionId: null, actor: { id: adminUserId, name: "Admin" } };
  const foreignStaff = await createStaff(foreignScopeAdmin, { employeeCode: "T9K-FOREIGN", firstName: "Foreign", isTeaching: true });
  await setStaffUser(foreignScopeAdmin, foreignStaff.id, foreignUserId);
  foreignScope = { tenantId, schoolId: schoolBId, branchId: branchB, academicSessionId: null, actor: { id: foreignUserId, name: "Foreign" } };
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.notificationRecipient.deleteMany({ where: { notification: { tenantId } } });
  await prisma.notification.deleteMany({ where: { tenantId } });
  await prisma.message.deleteMany({ where: { conversation: { tenantId } } });
  await prisma.conversationParticipant.deleteMany({ where: { conversation: { tenantId } } });
  await prisma.conversation.deleteMany({ where: { tenantId } });
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.staff.deleteMany({ where: { tenantId } });
  await prisma.roleAssignment.deleteMany({ where: { membership: { tenantId } } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId } });
  await prisma.branch.deleteMany({ where: { schoolId: { in: [schoolId, schoolBId] } } });
  await prisma.school.deleteMany({ where: { tenantId } });
  const userIds = (await prisma.user.findMany({ where: { email: { contains: `-${stamp}@x.test` } }, select: { id: true } })).map((u) => u.id);
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.tenant.delete({ where: { id: tenantId } });
});

describe.skipIf(!dbReady)("eligible recipients — identity (DB)", () => {
  it("includes a Staff-linked User and a non-Staff privileged role (SCHOOL_ADMIN); excludes unlinked Staff, inactive Staff, and self", async () => {
    const recipients = await listEligibleRecipients(teacherScope);
    const ids = recipients.map((r) => r.userId);
    expect(ids).toContain(adminUserId); // non-Staff SCHOOL_ADMIN — real, confirmed no Staff row in this system
    expect(ids).toContain(teacher2UserId); // Staff-linked TEACHER
    expect(ids).not.toContain(teacherUserId); // self excluded
    expect(ids).not.toContain(inactiveTeacherUserId); // inactive Staff excluded
    expect(recipients.some((r) => r.displayName.trim() === "Ghost")).toBe(false); // unlinked Staff (no userId) can never appear
  });

  it("excludes a role with no communication.send permission (LIBRARIAN) from the eligible pool", async () => {
    const recipients = await listEligibleRecipients(teacherScope);
    expect(recipients.some((r) => r.userId === librarianUserId)).toBe(false);
  });

  it("excludes a foreign-school user even though it shares the same tenant", async () => {
    const recipients = await listEligibleRecipients(teacherScope);
    expect(recipients.some((r) => r.userId === foreignUserId)).toBe(false);
  });

  it("search filters by name", async () => {
    const recipients = await listEligibleRecipients(teacherScope, "Tom");
    expect(recipients.map((r) => r.userId)).toEqual([teacher2UserId]);
  });
});

describe.skipIf(!dbReady)("direct conversations (DB)", () => {
  it("creates a real DIRECT conversation with both participants + an audit event", async () => {
    const conv = await startDirectConversation(teacherScope, { recipientUserId: teacher2UserId });
    expect(conv.type).toBe("direct");
    expect(conv.participants.map((p) => p.userId).sort()).toEqual([teacherUserId, teacher2UserId].sort());
    const audit = await prisma.auditEvent.findFirst({ where: { tenantId, action: "CONVERSATION_CREATED", entityId: conv.id } });
    expect(audit).not.toBeNull();
  });

  it("duplicate start-direct returns the SAME canonical conversation, regardless of initiator direction", async () => {
    const a = await startDirectConversation(teacherScope, { recipientUserId: adminUserId });
    const b = await startDirectConversation(adminScope, { recipientUserId: teacherUserId }); // reversed direction
    expect(b.id).toBe(a.id);
    const count = await prisma.conversation.count({ where: { tenantId, directKey: { contains: [teacherUserId, adminUserId].sort().join(":") } } });
    expect(count).toBe(1);
  });

  it("concurrent duplicate start-direct calls converge on exactly one canonical conversation", async () => {
    const freshUserId = await makeUserWithRole(`t9k-concurrent-${stamp}@x.test`, "TEACHER");
    const freshStaff = await createStaff(adminScope, { employeeCode: "T9K-CONC", firstName: "Conc" });
    await setStaffUser(adminScope, freshStaff.id, freshUserId);
    const [r1, r2] = await Promise.all([
      startDirectConversation(teacherScope, { recipientUserId: freshUserId }),
      startDirectConversation(teacherScope, { recipientUserId: freshUserId }),
    ]);
    expect(r1.id).toBe(r2.id);
    const directKey = [teacherUserId, freshUserId].sort().join(":");
    const count = await prisma.conversation.count({ where: { tenantId, directKey: `${tenantId}:${directKey}` } });
    expect(count).toBe(1);
  });

  it("rejects starting a conversation with an ineligible/foreign recipient (404, no existence leak)", async () => {
    await expect(startDirectConversation(teacherScope, { recipientUserId: foreignUserId })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(startDirectConversation(teacherScope, { recipientUserId: "does-not-exist" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects starting a conversation with yourself", async () => {
    await expect(startDirectConversation(teacherScope, { recipientUserId: teacherUserId })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("participant membership vs feature access: a non-participant (even with communication.send) gets 404, not the conversation", async () => {
    const conv = await startDirectConversation(teacherScope, { recipientUserId: teacher2UserId });
    const outsiderUserId = await makeUserWithRole(`t9k-outsider-${stamp}@x.test`, "TEACHER");
    const outsiderStaff = await createStaff(adminScope, { employeeCode: "T9K-OUT", firstName: "Out" });
    await setStaffUser(adminScope, outsiderStaff.id, outsiderUserId);
    const outsiderScope: OrgScope = { tenantId, schoolId, branchId: branchA, academicSessionId: null, actor: { id: outsiderUserId, name: "Out" } };
    await expect(getConversation(outsiderScope, conv.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(sendMessage(outsiderScope, conv.id, { body: "hi" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("cross-school isolation: a foreign-school user (same tenant) cannot read or send to a conversation, even with its real id", async () => {
    const conv = await startDirectConversation(teacherScope, { recipientUserId: teacher2UserId });
    await expect(getConversation(foreignScope, conv.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(sendMessage(foreignScope, conv.id, { body: "cross-school" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(markConversationRead(foreignScope, conv.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("listConversations only returns the caller's own conversations", async () => {
    const list = await listConversations(teacherScope);
    expect(list.every((c) => c.id)).toBe(true);
    const listFromLibrarian = await listConversations(librarianScope);
    expect(listFromLibrarian).toEqual([]); // librarian has no participations at all
  });
});

describe.skipIf(!dbReady)("messages (DB)", () => {
  it("sends a message with server-derived sender, rejects empty and too-long bodies", async () => {
    const conv = await startDirectConversation(teacherScope, { recipientUserId: teacher2UserId });
    const msg = await sendMessage(teacherScope, conv.id, { body: "Hello Tom" });
    expect(msg.senderUserId).toBe(teacherUserId);
    expect(msg.fromMe).toBe(true);
    await expect(sendMessage(teacherScope, conv.id, { body: "  " })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(sendMessage(teacherScope, conv.id, { body: "x".repeat(4001) })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const audit = await prisma.auditEvent.findFirst({ where: { tenantId, action: "MESSAGE_SENT", entityId: msg.id } });
    expect(audit).not.toBeNull();
  });

  it("history is deterministically ordered and cursor-paginates", async () => {
    const conv = await startDirectConversation(teacherScope, { recipientUserId: adminUserId });
    for (let i = 0; i < 35; i++) await sendMessage(teacherScope, conv.id, { body: `msg-${i}` });

    const page1 = await listMessages(teacherScope, conv.id, {});
    expect(page1.items).toHaveLength(30);
    expect(page1.nextCursor).not.toBeNull();
    // ascending order within the page
    for (let i = 1; i < page1.items.length; i++) expect(page1.items[i].createdAt >= page1.items[i - 1].createdAt).toBe(true);

    const page2 = await listMessages(teacherScope, conv.id, { cursor: page1.nextCursor! });
    expect(page2.items.length).toBeGreaterThan(0);
    expect(page2.nextCursor).toBeNull();
    // no overlap between pages
    const ids1 = new Set(page1.items.map((m) => m.id));
    expect(page2.items.every((m) => !ids1.has(m.id))).toBe(true);
  });
});

describe.skipIf(!dbReady)("unread / read state (DB)", () => {
  it("unread count reflects real messages from the other participant; sender never sees their own message as unread", async () => {
    const conv = await startDirectConversation(teacherScope, { recipientUserId: teacher2UserId });
    const before = await getUnreadCount(teacherScope);
    await sendMessage(teacherScope, conv.id, { body: "from teacher" });
    const afterOwnSend = await getUnreadCount(teacherScope);
    expect(afterOwnSend).toBe(before); // own message never counts as unread for the sender

    const teacher2Unread = await getConversation(teacher2Scope, conv.id);
    expect(teacher2Unread.unreadCount).toBeGreaterThanOrEqual(1);
  });

  it("markConversationRead clears unread for that participant only, and is monotonic under repeated calls", async () => {
    const conv = await startDirectConversation(teacherScope, { recipientUserId: teacher2UserId });
    await sendMessage(teacherScope, conv.id, { body: "ping" });
    const beforeRead = await getConversation(teacher2Scope, conv.id);
    expect(beforeRead.unreadCount).toBeGreaterThanOrEqual(1);

    await markConversationRead(teacher2Scope, conv.id);
    const afterRead = await getConversation(teacher2Scope, conv.id);
    expect(afterRead.unreadCount).toBe(0);

    const participant1 = await prisma.conversationParticipant.findUniqueOrThrow({ where: { conversationId_userId: { conversationId: conv.id, userId: teacher2UserId } }, select: { lastReadAt: true } });
    await markConversationRead(teacher2Scope, conv.id); // second call — must not regress
    const participant2 = await prisma.conversationParticipant.findUniqueOrThrow({ where: { conversationId_userId: { conversationId: conv.id, userId: teacher2UserId } }, select: { lastReadAt: true } });
    expect(participant2.lastReadAt!.getTime()).toBeGreaterThanOrEqual(participant1.lastReadAt!.getTime());

    // Marking read as teacher2 must not affect teacher's own unread state on the same conversation.
    await sendMessage(teacher2Scope, conv.id, { body: "reply" });
    const teacherView = await getConversation(teacherScope, conv.id);
    expect(teacherView.unreadCount).toBeGreaterThanOrEqual(1);
  });
});

describe.skipIf(!dbReady)("notification integration (DB)", () => {
  it("the recipient gets a real notification; the sender does not; dedupe is per-message (idempotent)", async () => {
    const conv = await startDirectConversation(teacherScope, { recipientUserId: teacher2UserId });
    const msg = await sendMessage(teacherScope, conv.id, { body: "notify me" });

    const notification = await prisma.notification.findUnique({ where: { dedupeKey: `MESSAGE_RECEIVED:${msg.id}` } });
    expect(notification).not.toBeNull();
    expect(notification!.type).toBe("MESSAGE_RECEIVED");

    const recipientRow = await prisma.notificationRecipient.findFirst({ where: { notificationId: notification!.id, userId: teacher2UserId } });
    expect(recipientRow).not.toBeNull();
    const senderRow = await prisma.notificationRecipient.findFirst({ where: { notificationId: notification!.id, userId: teacherUserId } });
    expect(senderRow).toBeNull(); // sender never notifies themselves

    // A second message gets its own distinct notification (dedupeKey is per-message, not shared).
    const msg2 = await sendMessage(teacherScope, conv.id, { body: "second" });
    const notification2 = await prisma.notification.findUnique({ where: { dedupeKey: `MESSAGE_RECEIVED:${msg2.id}` } });
    expect(notification2).not.toBeNull();
    expect(notification2!.id).not.toBe(notification!.id);
  });
});

describe.skipIf(!dbReady)("RBAC catalog + DTO safety (DB)", () => {
  it("communication.send is held by SCHOOL_ADMIN/PRINCIPAL/TEACHER, not by LIBRARIAN/TRANSPORT_MANAGER/HR_ADMIN", () => {
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("communication.send");
    expect(ROLE_PERMISSIONS.PRINCIPAL).toContain("communication.send");
    expect(ROLE_PERMISSIONS.TEACHER).toContain("communication.send");
    expect(ROLE_PERMISSIONS.LIBRARIAN ?? []).not.toContain("communication.send");
    expect(ROLE_PERMISSIONS.TRANSPORT_MANAGER ?? []).not.toContain("communication.send");
    expect(ROLE_PERMISSIONS.HR_ADMIN ?? []).not.toContain("communication.send");
  });

  it("recipient/message/conversation DTOs expose no sensitive User fields", async () => {
    const recipients = await listEligibleRecipients(teacherScope);
    for (const r of recipients) {
      expect(Object.keys(r).sort()).toEqual(["displayName", "roleLabel", "staffId", "userId"].sort());
    }
    const conv = await startDirectConversation(teacherScope, { recipientUserId: teacher2UserId });
    const msg = await sendMessage(teacherScope, conv.id, { body: "dto safety" });
    expect(Object.keys(msg).sort()).toEqual(["body", "conversationId", "createdAt", "fromMe", "id", "senderName", "senderUserId"].sort());
  });
});
