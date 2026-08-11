// Support DB-integration tests (Super Admin SA-4I). Exercises the real
// support-service against Postgres: create/list/search/filter/pagination,
// assignment (+ invalid assignee), messages + first-response semantics, internal
// notes, status lifecycle + invalid transition, derived escalation, summary,
// real health integration, RBAC and audit events. Namespaced ("T4SUP-").
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  addMessage,
  assignTicket,
  createTicket,
  getSupportSummary,
  getTicket,
  listTickets,
  setTicketStatus,
  type SupportActor,
} from "@/lib/server/platform/support-service";
import { platformPermissionsForRole, ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T4SUP";
const stamp = Date.now().toString(36);
const actor: SupportActor = { id: "t4sup-actor", name: "T4SUP Tester" };
let tenantId = "";
let schoolId = "";
let agentUserId = "";

async function newTicket(opts: { priority?: string; category?: string } = {}) {
  return createTicket(actor, { schoolId, subject: `${NS} ${stamp} ${Math.random().toString(36).slice(2, 6)}`, description: "Help needed", priority: opts.priority ?? "medium", category: opts.category ?? "other" });
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} Tenant`, slug: `t4sup-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} School`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  // A real platform admin to assign tickets to.
  const user = await prisma.user.create({ data: { email: `${NS.toLowerCase()}.${stamp}@agent.test`, name: `${NS} Agent`, status: "ACTIVE" }, select: { id: true } });
  agentUserId = user.id;
  await prisma.platformAdmin.create({ data: { userId: user.id, role: "SUPPORT", status: "ACTIVE" } });
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.supportTicket.deleteMany({ where: { tenantId } }); // cascades messages
  await prisma.tenant.delete({ where: { id: tenantId } }); // cascades school
  if (agentUserId) await prisma.user.delete({ where: { id: agentUserId } }).catch(() => {}); // cascades platformAdmin
});

describe.skipIf(!dbReady)("support service (DB)", () => {
  it("creates a ticket (real row, ticket number, audit)", async () => {
    const t = await newTicket({ priority: "high", category: "billing" });
    expect(t.ticketNumber).toMatch(/^SUP-\d{4}-\d{6}$/);
    expect(t.status).toBe("open");
    expect(t.priority).toBe("high");
    expect(t.tenant.id).toBe(tenantId);
    expect(t.school?.id).toBe(schoolId);
    const row = await prisma.supportTicket.findUniqueOrThrow({ where: { id: t.id }, select: { subject: true, tenantId: true } });
    expect(row.tenantId).toBe(tenantId);
    const audit = await prisma.auditEvent.findFirst({ where: { entityId: t.id, action: "SUPPORT_TICKET_CREATED" } });
    expect(audit).not.toBeNull();
  });

  it("assigns to a real platform admin and rejects an invalid assignee", async () => {
    const t = await newTicket();
    const assigned = await assignTicket(actor, t.id, { assignedToUserId: agentUserId });
    expect(assigned.assignedTo?.userId).toBe(agentUserId);
    const row = await prisma.supportTicket.findUniqueOrThrow({ where: { id: t.id }, select: { assignedToUserId: true } });
    expect(row.assignedToUserId).toBe(agentUserId);
    await expect(assignTicket(actor, t.id, { assignedToUserId: "not-an-admin" })).rejects.toMatchObject({ code: "INVALID_ASSIGNEE" });
    // Unassign.
    const un = await assignTicket(actor, t.id, { assignedToUserId: null });
    expect(un.assignedTo).toBeNull();
  });

  it("sets firstResponseAt on the first public message only; notes don't count", async () => {
    const t = await newTicket();
    // An internal note first — must NOT set firstResponseAt.
    await addMessage(actor, t.id, { body: "internal triage", internal: true });
    let row = await prisma.supportTicket.findUniqueOrThrow({ where: { id: t.id }, select: { firstResponseAt: true } });
    expect(row.firstResponseAt).toBeNull();

    const afterFirst = await addMessage(actor, t.id, { body: "Hi, looking into it", internal: false });
    expect(afterFirst.firstResponseAt).not.toBeNull();
    const firstAt = (await prisma.supportTicket.findUniqueOrThrow({ where: { id: t.id }, select: { firstResponseAt: true } })).firstResponseAt;

    // Second public message must not move firstResponseAt.
    await addMessage(actor, t.id, { body: "Any update?", internal: false });
    row = await prisma.supportTicket.findUniqueOrThrow({ where: { id: t.id }, select: { firstResponseAt: true } });
    expect(row.firstResponseAt?.getTime()).toBe(firstAt?.getTime());

    // DTO splits messages vs internal notes.
    const detail = await getTicket(t.id);
    expect(detail.messages.length).toBe(2);
    expect(detail.internalNotes.length).toBe(1);
    const audit = await prisma.auditEvent.count({ where: { entityId: t.id, action: { in: ["SUPPORT_MESSAGE_ADDED", "SUPPORT_NOTE_ADDED"] } } });
    expect(audit).toBe(3);
  });

  it("moves through the lifecycle: resolve sets resolvedAt, close sets closedAt, reopen clears them", async () => {
    const t = await newTicket();
    const resolved = await setTicketStatus(actor, t.id, { status: "resolved" });
    expect(resolved.status).toBe("resolved");
    expect(resolved.resolvedAt).not.toBeNull();
    const closed = await setTicketStatus(actor, t.id, { status: "closed" });
    expect(closed.closedAt).not.toBeNull();
    // Reopen clears terminal timestamps.
    const reopened = await setTicketStatus(actor, t.id, { status: "open" });
    expect(reopened.status).toBe("open");
    const row = await prisma.supportTicket.findUniqueOrThrow({ where: { id: t.id }, select: { resolvedAt: true, closedAt: true } });
    expect(row.resolvedAt).toBeNull();
    expect(row.closedAt).toBeNull();
    const audit = await prisma.auditEvent.count({ where: { entityId: t.id, action: "SUPPORT_TICKET_STATUS_CHANGED" } });
    expect(audit).toBe(3);
  });

  it("rejects an invalid / same status transition", async () => {
    const t = await newTicket();
    await expect(setTicketStatus(actor, t.id, { status: "open" })).rejects.toMatchObject({ code: "INVALID_TICKET_TRANSITION" }); // already open
    await setTicketStatus(actor, t.id, { status: "closed" });
    // CLOSED may only reopen to OPEN — not directly to resolved.
    await expect(setTicketStatus(actor, t.id, { status: "resolved" })).rejects.toMatchObject({ code: "INVALID_TICKET_TRANSITION" });
  });

  it("derives escalation (URGENT open = escalated; LOW = not)", async () => {
    const urgent = await newTicket({ priority: "urgent" });
    expect(urgent.escalated).toBe(true);
    const low = await newTicket({ priority: "low" });
    expect(low.escalated).toBe(false);
    // Resolving an urgent ticket clears escalation (terminal).
    const done = await setTicketStatus(actor, urgent.id, { status: "resolved" });
    expect(done.escalated).toBe(false);
  });

  it("lists with search, status + priority filters, escalated filter and pagination", async () => {
    await newTicket({ priority: "urgent" });
    const search = await listTickets({ page: 1, pageSize: 100, search: NS });
    expect(search.data.length).toBeGreaterThan(0);
    const open = await listTickets({ page: 1, pageSize: 100, search: NS, status: "open" });
    expect(open.data.every((t) => t.status === "open")).toBe(true);
    const urgent = await listTickets({ page: 1, pageSize: 100, search: NS, priority: "urgent" });
    expect(urgent.data.every((t) => t.priority === "urgent")).toBe(true);
    const escalated = await listTickets({ page: 1, pageSize: 100, search: NS, escalated: true });
    expect(escalated.data.every((t) => t.escalated)).toBe(true);
    const paged = await listTickets({ page: 1, pageSize: 1, search: NS });
    expect(paged.data.length).toBe(1);
  });

  it("summary reflects real open/urgent/escalated/unassigned counts", async () => {
    const s = await getSupportSummary();
    expect(s.openTickets).toBeGreaterThanOrEqual(1);
    expect(s.urgentTickets).toBeGreaterThanOrEqual(1);
    expect(s.escalatedTickets).toBeGreaterThanOrEqual(1);
    expect(s.unassignedTickets).toBeGreaterThanOrEqual(1);
  });

  it("ticket detail includes real SA-4F health + a safe DTO (NOT_FOUND otherwise)", async () => {
    const t = await newTicket();
    const detail = await getTicket(t.id);
    expect(detail.health).not.toBeNull();
    expect(typeof detail.health!.state).toBe("string");
    expect(Object.keys(detail.tenant).sort()).toEqual(["id", "name"]);
    await expect(getTicket("missing")).rejects.toMatchObject({ code: "TICKET_NOT_FOUND" });
  });

  it("RBAC: platform.support.* is platform-scoped and denied to school roles", async () => {
    for (const role of ["SUPER_ADMIN", "SUPPORT"]) {
      expect(platformPermissionsForRole(role)).toEqual(expect.arrayContaining(["platform.support.view", "platform.support.manage"]));
    }
    expect(platformPermissionsForRole("AUDITOR")).toContain("platform.support.view");
    expect(platformPermissionsForRole("AUDITOR")).not.toContain("platform.support.manage");
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      expect(perms).not.toContain("platform.support.view");
      expect(perms).not.toContain("platform.support.manage");
    }
  });
});
