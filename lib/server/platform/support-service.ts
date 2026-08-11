// Platform (Super Admin) support service (Phase SA-4I). Platform-level support
// tickets against real Tenants/Schools. Ticket numbers come from a Postgres
// sequence (concurrency-safe). Escalation is DERIVED (never stored). Assignment
// targets a validated platform admin. Conversation + internal notes share one
// table (`internal` flag) and are split in the DTO. Audit events are recorded
// with safe metadata only (no full message bodies).
//
// The Support ticket health badge reuses the real SA-4F health service — there is
// no second tenant-health calculation here.
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { parseInput } from "@/lib/server/validation";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ListMeta } from "@/lib/server/api/response";
import { supportCategoryFromUi, supportCategoryToUi, supportPriorityFromUi, supportPriorityToUi, supportStatusFromUi, supportStatusToUi } from "@/lib/server/api/enums";
import { getSchoolHealth } from "./health-service";
import type { Prisma, SupportTicketPriority, SupportTicketStatus } from "@/lib/generated/prisma/client";

export type SupportActor = { id: string; name: string | null };

const DAY = 86_400_000;
// A HIGH-priority ticket escalates once it has been open this long.
const ESCALATION_HIGH_DAYS = 3;
// Non-terminal statuses (a ticket still needs work).
const OPEN_STATUSES: SupportTicketStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER"];

// Central status transition map (SA-4I §4).
const VALID_TRANSITIONS: Record<SupportTicketStatus, SupportTicketStatus[]> = {
  OPEN: ["IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"],
  IN_PROGRESS: ["OPEN", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"],
  WAITING_CUSTOMER: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
  RESOLVED: ["OPEN", "IN_PROGRESS", "CLOSED"],
  CLOSED: ["OPEN"],
};

/** Derived escalation — URGENT (open) or HIGH open longer than the threshold. */
function isEscalated(status: SupportTicketStatus, priority: SupportTicketPriority, openedAt: Date, now: Date): boolean {
  if (!OPEN_STATUSES.includes(status)) return false;
  if (priority === "URGENT") return true;
  return priority === "HIGH" && now.getTime() - openedAt.getTime() > ESCALATION_HIGH_DAYS * DAY;
}

// --- Validation -------------------------------------------------------------

const priorityUi = z.enum(["low", "medium", "high", "urgent"]);
const categoryUi = z.enum(["billing", "account", "technical", "onboarding", "feature", "other"]);

export const ticketCreateSchema = z
  .object({
    schoolId: z.string().trim().min(1).optional(),
    tenantId: z.string().trim().min(1).optional(),
    subject: z.string().trim().min(1, "Subject is required").max(200),
    description: z.string().trim().min(1, "Description is required").max(5000),
    category: categoryUi.default("other"),
    priority: priorityUi.default("medium"),
  })
  .refine((v) => v.schoolId || v.tenantId, { message: "A school or tenant is required" });

export const ticketUpdateSchema = z
  .object({ subject: z.string().trim().min(1).max(200), priority: priorityUi, category: categoryUi })
  .partial();

export const ticketStatusSchema = z.object({ status: z.enum(["open", "in-progress", "waiting-customer", "resolved", "closed"]) });
export const ticketAssignSchema = z.object({ assignedToUserId: z.string().trim().min(1).nullable() });
export const ticketMessageSchema = z.object({ body: z.string().trim().min(1, "Message cannot be empty").max(5000), internal: z.boolean().default(false) });

// --- Serializer -------------------------------------------------------------

type TicketRow = Prisma.SupportTicketGetPayload<{
  include: {
    tenant: { select: { id: true; name: true } };
    school: { select: { id: true; name: true; code: true } };
    _count: { select: { messages: true } };
  };
}>;

function serialize(t: TicketRow, now: Date) {
  return {
    id: t.id,
    ticketNumber: t.ticketNumber,
    subject: t.subject,
    category: supportCategoryToUi[t.category],
    priority: supportPriorityToUi[t.priority],
    status: supportStatusToUi[t.status],
    escalated: isEscalated(t.status, t.priority, t.openedAt, now),
    tenant: { id: t.tenant.id, name: t.tenant.name },
    school: t.school ? { id: t.school.id, name: t.school.name, code: t.school.code } : null,
    assignedTo: t.assignedToUserId ? { userId: t.assignedToUserId, name: t.assignedToName } : null,
    openedAt: t.openedAt.toISOString(),
    firstResponseAt: t.firstResponseAt?.toISOString() ?? null,
    resolvedAt: t.resolvedAt?.toISOString() ?? null,
    closedAt: t.closedAt?.toISOString() ?? null,
    messageCount: t._count.messages,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export type SupportTicketDto = ReturnType<typeof serialize>;

const includeRelations = {
  tenant: { select: { id: true, name: true } },
  school: { select: { id: true, name: true, code: true } },
  _count: { select: { messages: true } },
} as const;

function auditScope(actor: SupportActor, tenantId: string, schoolId: string | null): OrgScope {
  return { tenantId, schoolId: schoolId ?? "", branchId: null, academicSessionId: null, actor };
}

async function nextTicketNumber(tx: Prisma.TransactionClient, year: number): Promise<string> {
  const rows = await tx.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('support_ticket_number_seq') AS nextval`;
  return `SUP-${year}-${String(Number(rows[0].nextval)).padStart(6, "0")}`;
}

// --- Reads ------------------------------------------------------------------

export type TicketListParams = {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  priority?: string;
  category?: string;
  assignment?: string; // "unassigned" | userId
  escalated?: boolean;
  schoolId?: string;
  tenantId?: string;
  sort?: "updatedAt" | "openedAt" | "priority";
  order?: "asc" | "desc";
};

export async function listTickets(params: TicketListParams) {
  const now = new Date();
  const where: Prisma.SupportTicketWhereInput = {};
  if (params.search) {
    const q = params.search.trim();
    where.OR = [
      { ticketNumber: { contains: q, mode: "insensitive" } },
      { subject: { contains: q, mode: "insensitive" } },
      { school: { name: { contains: q, mode: "insensitive" } } },
      { tenant: { name: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (params.status && supportStatusFromUi[params.status]) where.status = supportStatusFromUi[params.status];
  if (params.priority && supportPriorityFromUi[params.priority]) where.priority = supportPriorityFromUi[params.priority];
  if (params.category && supportCategoryFromUi[params.category]) where.category = supportCategoryFromUi[params.category];
  if (params.assignment === "unassigned") where.assignedToUserId = null;
  else if (params.assignment) where.assignedToUserId = params.assignment;
  if (params.schoolId) where.schoolId = params.schoolId;
  if (params.tenantId) where.tenantId = params.tenantId;
  if (params.escalated) {
    // Derived escalation as a where-clause. Kept in an AND so it doesn't mix with
    // the search OR: non-terminal AND (URGENT OR HIGH-and-old).
    where.status = { in: OPEN_STATUSES };
    where.AND = [{ OR: [{ priority: "URGENT" }, { priority: "HIGH", openedAt: { lt: new Date(now.getTime() - ESCALATION_HIGH_DAYS * DAY) } }] }];
  }

  const order = params.order ?? "desc";
  let orderBy: Prisma.SupportTicketOrderByWithRelationInput;
  switch (params.sort) {
    case "openedAt":
      orderBy = { openedAt: order };
      break;
    case "priority":
      orderBy = { priority: order };
      break;
    default:
      orderBy = { updatedAt: order };
  }

  const [total, rows] = await Promise.all([
    prisma.supportTicket.count({ where }),
    prisma.supportTicket.findMany({ where, orderBy, skip: (params.page - 1) * params.pageSize, take: params.pageSize, include: includeRelations }),
  ]);
  const meta: ListMeta = { page: params.page, pageSize: params.pageSize, total, totalPages: Math.max(1, Math.ceil(total / params.pageSize)) };
  return { data: rows.map((r) => serialize(r, now)), meta };
}

export async function getTicket(id: string) {
  const t = await prisma.supportTicket.findUnique({
    where: { id },
    include: { ...includeRelations, messages: { orderBy: { createdAt: "asc" }, select: { id: true, authorUserId: true, authorName: true, body: true, internal: true, createdAt: true } } },
  });
  if (!t) throw new HttpError("TICKET_NOT_FOUND", "Ticket not found");
  const now = new Date();
  const base = serialize(t, now);
  const toMsg = (m: (typeof t.messages)[number]) => ({ id: m.id, authorUserId: m.authorUserId, authorName: m.authorName, body: m.body, createdAt: m.createdAt.toISOString() });
  // Real SA-4F health for the ticket's school (no second calculation here).
  const health = t.schoolId ? await getSchoolHealth(t.schoolId) : null;
  return {
    ...base,
    description: t.description,
    messages: t.messages.filter((m) => !m.internal).map(toMsg),
    internalNotes: t.messages.filter((m) => m.internal).map(toMsg),
    health: health ? { state: health.healthState, reasons: health.reasons } : null,
  };
}

// --- Support agents (assignable platform admins) ----------------------------

export async function listAgents() {
  const admins = await prisma.platformAdmin.findMany({
    where: { status: "ACTIVE" },
    select: { userId: true, role: true, user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return admins.map((a) => ({ userId: a.userId, name: a.user.name, email: a.user.email, role: a.role.toLowerCase() }));
}

// --- Writes -----------------------------------------------------------------

export async function createTicket(actor: SupportActor, raw: unknown) {
  const input = parseInput(ticketCreateSchema, raw);

  let tenantId: string;
  let schoolId: string | null = null;
  if (input.schoolId) {
    const school = await prisma.school.findUnique({ where: { id: input.schoolId }, select: { id: true, tenantId: true } });
    if (!school) throw new HttpError("INVALID_SCHOOL", "School not found");
    schoolId = school.id;
    tenantId = school.tenantId;
  } else {
    const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId! }, select: { id: true } });
    if (!tenant) throw new HttpError("INVALID_SCHOOL", "Tenant not found");
    tenantId = tenant.id;
  }

  const created = await prisma.$transaction(async (tx) => {
    const ticketNumber = await nextTicketNumber(tx, new Date().getUTCFullYear());
    const ticket = await tx.supportTicket.create({
      data: {
        ticketNumber,
        tenantId,
        schoolId,
        subject: input.subject,
        description: input.description,
        category: supportCategoryFromUi[input.category],
        priority: supportPriorityFromUi[input.priority],
        status: "OPEN",
        createdByUserId: actor.id,
        createdByName: actor.name,
      },
      include: includeRelations,
    });
    await recordAudit(tx, auditScope(actor, tenantId, schoolId), "SUPPORT_TICKET_CREATED", "SupportTicket", ticket.id, { ticketNumber, priority: input.priority });
    return ticket;
  });
  return serialize(created, new Date());
}

async function loadTicket(id: string) {
  const t = await prisma.supportTicket.findUnique({ where: { id }, select: { id: true, tenantId: true, schoolId: true, status: true, firstResponseAt: true } });
  if (!t) throw new HttpError("TICKET_NOT_FOUND", "Ticket not found");
  return t;
}

export async function updateTicket(id: string, raw: unknown) {
  const input = parseInput(ticketUpdateSchema, raw);
  await loadTicket(id);
  const data: Prisma.SupportTicketUpdateInput = {};
  if (input.subject !== undefined) data.subject = input.subject;
  if (input.priority !== undefined) data.priority = supportPriorityFromUi[input.priority];
  if (input.category !== undefined) data.category = supportCategoryFromUi[input.category];
  const updated = await prisma.supportTicket.update({ where: { id }, data, include: includeRelations });
  return serialize(updated, new Date());
}

export async function setTicketStatus(actor: SupportActor, id: string, raw: unknown) {
  const input = parseInput(ticketStatusSchema, raw);
  const t = await loadTicket(id);
  const next = supportStatusFromUi[input.status];
  if (t.status === next) throw new HttpError("INVALID_TICKET_TRANSITION", `Ticket is already ${input.status}`);
  if (!VALID_TRANSITIONS[t.status].includes(next)) {
    throw new HttpError("INVALID_TICKET_TRANSITION", `Cannot move a ${supportStatusToUi[t.status]} ticket to ${input.status}`);
  }
  const now = new Date();
  const data: Prisma.SupportTicketUpdateInput = { status: next };
  if (next === "RESOLVED") data.resolvedAt = now;
  else if (next === "CLOSED") data.closedAt = now;
  // Reopening a terminal ticket clears the terminal timestamps.
  if (OPEN_STATUSES.includes(next)) {
    data.resolvedAt = null;
    data.closedAt = null;
  }
  const updated = await prisma.supportTicket.update({ where: { id }, data, include: includeRelations });
  await recordAudit(prisma, auditScope(actor, t.tenantId, t.schoolId), "SUPPORT_TICKET_STATUS_CHANGED", "SupportTicket", id, { from: supportStatusToUi[t.status], to: input.status });
  return serialize(updated, now);
}

export async function assignTicket(actor: SupportActor, id: string, raw: unknown) {
  const input = parseInput(ticketAssignSchema, raw);
  const t = await loadTicket(id);

  let assignedToUserId: string | null = null;
  let assignedToName: string | null = null;
  if (input.assignedToUserId) {
    // Assignee must be an ACTIVE platform admin.
    const admin = await prisma.platformAdmin.findFirst({ where: { userId: input.assignedToUserId, status: "ACTIVE" }, select: { userId: true, user: { select: { name: true } } } });
    if (!admin) throw new HttpError("INVALID_ASSIGNEE", "Assignee must be an active platform admin");
    assignedToUserId = admin.userId;
    assignedToName = admin.user.name;
  }
  const updated = await prisma.supportTicket.update({ where: { id }, data: { assignedToUserId, assignedToName }, include: includeRelations });
  await recordAudit(prisma, auditScope(actor, t.tenantId, t.schoolId), "SUPPORT_TICKET_ASSIGNED", "SupportTicket", id, { assignedTo: assignedToName ?? "unassigned" });
  return serialize(updated, new Date());
}

export async function addMessage(actor: SupportActor, id: string, raw: unknown) {
  const input = parseInput(ticketMessageSchema, raw);
  const t = await loadTicket(id);

  await prisma.$transaction(async (tx) => {
    await tx.supportTicketMessage.create({ data: { ticketId: id, authorUserId: actor.id, authorName: actor.name ?? "Platform", body: input.body, internal: input.internal } });
    // First response = the first NON-internal staff message; set once.
    if (!input.internal && t.firstResponseAt === null) {
      await tx.supportTicket.update({ where: { id }, data: { firstResponseAt: new Date() } });
    } else {
      await tx.supportTicket.update({ where: { id }, data: { updatedAt: new Date() } });
    }
    await recordAudit(tx, auditScope(actor, t.tenantId, t.schoolId), input.internal ? "SUPPORT_NOTE_ADDED" : "SUPPORT_MESSAGE_ADDED", "SupportTicket", id, { internal: input.internal });
  });
  return getTicket(id);
}

// --- Summary ----------------------------------------------------------------

export type SupportSummary = {
  openTickets: number;
  urgentTickets: number;
  escalatedTickets: number;
  unassignedTickets: number;
};

export async function getSupportSummary(): Promise<SupportSummary> {
  const now = new Date();
  const escalatedWhere: Prisma.SupportTicketWhereInput = {
    status: { in: OPEN_STATUSES },
    OR: [{ priority: "URGENT" }, { priority: "HIGH", openedAt: { lt: new Date(now.getTime() - ESCALATION_HIGH_DAYS * DAY) } }],
  };
  const [openTickets, urgentTickets, escalatedTickets, unassignedTickets] = await Promise.all([
    prisma.supportTicket.count({ where: { status: { in: OPEN_STATUSES } } }),
    prisma.supportTicket.count({ where: { status: { in: OPEN_STATUSES }, priority: "URGENT" } }),
    prisma.supportTicket.count({ where: escalatedWhere }),
    prisma.supportTicket.count({ where: { status: { in: OPEN_STATUSES }, assignedToUserId: null } }),
  ]);
  return { openTickets, urgentTickets, escalatedTickets, unassignedTickets };
}
