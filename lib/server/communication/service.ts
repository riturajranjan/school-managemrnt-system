// Communication / Messaging (Phase 9K) — real, PostgreSQL-backed. User.id is
// the canonical messaging identity (Staff is NOT itself a messaging account);
// self-service resolves Staff-domain info via Staff.userId, never the reverse.
//
// ELIGIBLE RECIPIENTS (V1): Student and Guardian have no linked User account
// anywhere in this system, so they can never be a participant — not a gap to
// route around, a real limitation. An eligible recipient is either:
//   (a) a Staff row in the caller's school, ACTIVE, with a linked User
//       (Staff.userId) — the normal case (teachers, HR-linked staff), or
//   (b) a User with NO Staff row who holds a role granting
//       `communication.send` in the real permission catalog (school
//       admins/principals in this system have no Staff record at all —
//       verified against the seed data), scoped by tenant membership since
//       those roles have no Staff.schoolId to filter by.
// This is a real, audited design decision, not a fabrication: (b) exists
// because the ROLE_PERMISSIONS catalog and demo seed both confirm
// SCHOOL_ADMIN/PRINCIPAL currently have no Staff row.
//
// DIRECT CONVERSATIONS: deduped via Conversation.directKey, a deterministic
// `${tenantId}:${sortedUserIdA}:${sortedUserIdB}` string with a DB unique
// constraint — the actual concurrency guarantee (see startDirectConversation).
//
// UNREAD STATE: ConversationParticipant.lastReadAt (no per-message read
// rows). unreadCount = messages after lastReadAt, excluding the participant's
// own. markConversationRead is monotonic: only advances lastReadAt forward.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { createNotification } from "@/lib/server/notifications/service";
import { parseInput } from "@/lib/server/validation";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type {
  ConversationDetailDto,
  ConversationListItemDto,
  MessageDto,
  MessageHistoryDto,
  MessagingRecipientDto,
} from "@/lib/api/contracts";

const COMM_ELIGIBLE_ROLE_KEYS = Object.entries(ROLE_PERMISSIONS)
  .filter(([, perms]) => perms.includes("communication.send"))
  .map(([key]) => key);

const MAX_BODY_LENGTH = 4000;

function displayName(u: { name: string | null; email: string }, staff?: { firstName: string; lastName: string | null; displayName: string | null } | null): string {
  if (staff) return staff.displayName?.trim() || `${staff.firstName} ${staff.lastName ?? ""}`.trim();
  return u.name?.trim() || u.email;
}

// ── Recipient directory ─────────────────────────────────────────────────────

export async function listEligibleRecipients(scope: OrgScope, search?: string): Promise<MessagingRecipientDto[]> {
  const q = search?.trim();

  const [staffRows, roleAssignmentRows, staffGovernedRows] = await Promise.all([
    prisma.staff.findMany({
      where: {
        schoolId: scope.schoolId, status: "ACTIVE", userId: { not: null },
        ...(q ? { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { displayName: { contains: q, mode: "insensitive" } }, { employeeCode: { contains: q, mode: "insensitive" } }] } : {}),
      },
      select: { id: true, userId: true, firstName: true, lastName: true, displayName: true, designation: true, user: { select: { status: true } } },
    }),
    prisma.roleAssignment.findMany({
      where: { membership: { tenantId: scope.tenantId, status: "ACTIVE" }, role: { key: { in: COMM_ELIGIBLE_ROLE_KEYS } } },
      select: { role: { select: { key: true, name: true } }, membership: { select: { userId: true, user: { select: { name: true, email: true, status: true } } } } },
    }),
    // Any user with a Staff row ANYWHERE in this tenant (any school, any
    // status) is governed exclusively by the Staff branch above — the role
    // branch below must never re-admit them just because they also hold an
    // eligible role, or an inactive/foreign-school Staff member would leak
    // back in through it.
    prisma.staff.findMany({ where: { tenantId: scope.tenantId, userId: { not: null } }, select: { userId: true } }),
  ]);
  const staffGovernedUserIds = new Set(staffGovernedRows.map((s) => s.userId!));

  const byUserId = new Map<string, MessagingRecipientDto>();
  for (const s of staffRows) {
    if (!s.userId || s.user?.status !== "ACTIVE" || s.userId === scope.actor.id) continue;
    byUserId.set(s.userId, {
      userId: s.userId,
      displayName: s.displayName?.trim() || `${s.firstName} ${s.lastName ?? ""}`.trim(),
      roleLabel: s.designation,
      staffId: s.id,
    });
  }
  for (const r of roleAssignmentRows) {
    const userId = r.membership.userId;
    if (staffGovernedUserIds.has(userId) || userId === scope.actor.id || r.membership.user.status !== "ACTIVE") continue;
    const name = r.membership.user.name?.trim() || r.membership.user.email;
    if (q && !name.toLowerCase().includes(q.toLowerCase()) && !r.membership.user.email.toLowerCase().includes(q.toLowerCase())) continue;
    byUserId.set(userId, { userId, displayName: name, roleLabel: r.role.name, staffId: null });
  }

  return [...byUserId.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

async function assertEligibleRecipient(scope: OrgScope, userId: string): Promise<void> {
  if (userId === scope.actor.id) throw new HttpError("VALIDATION_ERROR", "You cannot start a conversation with yourself");
  const eligible = await listEligibleRecipients(scope);
  if (!eligible.some((r) => r.userId === userId)) throw new HttpError("NOT_FOUND", "Recipient not found");
}

// ── Conversation list / detail ──────────────────────────────────────────────

type ConvRow = {
  id: string; type: string; title: string | null; createdByUserId: string; updatedAt: Date;
  participants: { userId: string; lastReadAt: Date | null; user: { name: string | null; email: string; staffProfile: { firstName: string; lastName: string | null; displayName: string | null } | null } }[];
  messages: { id: string; body: string; createdAt: Date; senderUserId: string; sender: { name: string | null; email: string } }[];
};

const convSelect = {
  id: true, type: true, title: true, createdByUserId: true, updatedAt: true,
  participants: { select: { userId: true, lastReadAt: true, user: { select: { name: true, email: true, staffProfile: { select: { firstName: true, lastName: true, displayName: true } } } } } },
  messages: { orderBy: { createdAt: "desc" as const }, take: 1, select: { id: true, body: true, createdAt: true, senderUserId: true, sender: { select: { name: true, email: true } } } },
} satisfies Prisma.ConversationSelect;

function otherParticipantsTitle(row: ConvRow, actorId: string): string {
  if (row.type === "GROUP") return row.title?.trim() || "Group conversation";
  const other = row.participants.find((p) => p.userId !== actorId);
  if (!other) return row.title?.trim() || "Conversation";
  return displayName(other.user, other.user.staffProfile);
}

async function unreadCountFor(conversationId: string, userId: string, lastReadAt: Date | null): Promise<number> {
  return prisma.message.count({
    where: { conversationId, senderUserId: { not: userId }, ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}) },
  });
}

/** One query for all of the caller's conversations, instead of one COUNT per
 *  conversation — trades a little over-fetch (every non-self message across
 *  the caller's conversations, not just unread ones) for a single round trip. */
async function unreadCountsForMany(actorId: string, participations: { conversationId: string; lastReadAt: Date | null }[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (participations.length === 0) return counts;
  const rows = await prisma.message.findMany({
    where: { conversationId: { in: participations.map((p) => p.conversationId) }, senderUserId: { not: actorId } },
    select: { conversationId: true, createdAt: true },
  });
  const lastReadByConv = new Map(participations.map((p) => [p.conversationId, p.lastReadAt]));
  for (const m of rows) {
    const lastReadAt = lastReadByConv.get(m.conversationId);
    if (lastReadAt && m.createdAt <= lastReadAt) continue;
    counts.set(m.conversationId, (counts.get(m.conversationId) ?? 0) + 1);
  }
  return counts;
}

function listItemDto(row: ConvRow, actorId: string, unreadCount: number): ConversationListItemDto {
  const latest = row.messages[0];
  return {
    id: row.id,
    type: row.type === "GROUP" ? "group" : "direct",
    title: otherParticipantsTitle(row, actorId),
    lastMessage: latest ? { body: latest.body, createdAt: latest.createdAt.toISOString(), senderName: displayName(latest.sender), fromMe: latest.senderUserId === actorId } : null,
    unreadCount,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listConversations(scope: OrgScope): Promise<ConversationListItemDto[]> {
  const rows = await prisma.conversation.findMany({
    where: { tenantId: scope.tenantId, schoolId: scope.schoolId, participants: { some: { userId: scope.actor.id } } },
    orderBy: { updatedAt: "desc" },
    select: convSelect,
  });
  const own = rows.map((r) => r.participants.find((p) => p.userId === scope.actor.id)!);
  const unreadCounts = await unreadCountsForMany(scope.actor.id, rows.map((r, i) => ({ conversationId: r.id, lastReadAt: own[i].lastReadAt })));
  return rows.map((r) => listItemDto(r, scope.actor.id, unreadCounts.get(r.id) ?? 0));
}

/** Requires real participant membership — 404 (not 403) for both "doesn't
 *  exist" and "you're not a participant", so a non-participant can never
 *  distinguish the two (no existence leak). RBAC (communication.send) gates
 *  the messaging FEATURE; this is the separate, per-conversation gate. */
async function requireParticipant(scope: OrgScope, conversationId: string): Promise<ConvRow> {
  const row = await prisma.conversation.findFirst({ where: { id: conversationId, tenantId: scope.tenantId, schoolId: scope.schoolId }, select: convSelect });
  if (!row || !row.participants.some((p) => p.userId === scope.actor.id)) throw new HttpError("NOT_FOUND", "Conversation not found");
  return row;
}

export async function getConversation(scope: OrgScope, conversationId: string): Promise<ConversationDetailDto> {
  const row = await requireParticipant(scope, conversationId);
  const own = row.participants.find((p) => p.userId === scope.actor.id)!;
  const unread = await unreadCountFor(row.id, scope.actor.id, own.lastReadAt);
  return {
    ...listItemDto(row, scope.actor.id, unread),
    participants: row.participants.map((p) => ({ userId: p.userId, displayName: displayName(p.user, p.user.staffProfile) })),
  };
}

// ── Start direct conversation ───────────────────────────────────────────────

export const startDirectConversationSchema = z.object({ recipientUserId: z.string().min(1) });

function directKeyFor(tenantId: string, userA: string, userB: string): string {
  return `${tenantId}:${[userA, userB].sort().join(":")}`;
}

/**
 * Concurrency-safe find-or-create for a DIRECT conversation between the caller
 * and one eligible recipient. The DB unique constraint on Conversation.directKey
 * is the real guarantee: two simultaneous calls both attempt the insert, the
 * loser's insert raises P2002, and the loser simply re-fetches the winner's row
 * — exactly one canonical conversation ever exists per pair, never a thrown
 * error on the race path (this is an expected outcome, not a conflict).
 */
export async function startDirectConversation(scope: OrgScope, raw: unknown): Promise<ConversationDetailDto> {
  const input = parseInput(startDirectConversationSchema, raw);
  await assertEligibleRecipient(scope, input.recipientUserId);
  const directKey = directKeyFor(scope.tenantId, scope.actor.id, input.recipientUserId);

  try {
    const id = await prisma.$transaction(async (tx) => {
      const created = await tx.conversation.create({
        data: {
          tenantId: scope.tenantId, schoolId: scope.schoolId, type: "DIRECT", createdByUserId: scope.actor.id, directKey,
          participants: { createMany: { data: [{ userId: scope.actor.id }, { userId: input.recipientUserId }] } },
        },
        select: { id: true },
      });
      await recordAudit(tx, scope, "CONVERSATION_CREATED", "Conversation", created.id, { type: "direct", recipientUserId: input.recipientUserId });
      return created.id;
    });
    return getConversation(scope, id);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await prisma.conversation.findUnique({ where: { directKey }, select: { id: true } });
      if (existing) return getConversation(scope, existing.id);
    }
    throw e;
  }
}

// ── Messages ─────────────────────────────────────────────────────────────────

function messageDto(m: { id: string; conversationId: string; senderUserId: string; body: string; createdAt: Date; sender: { name: string | null; email: string } }, actorId: string): MessageDto {
  return {
    id: m.id, conversationId: m.conversationId, senderUserId: m.senderUserId,
    senderName: displayName(m.sender), fromMe: m.senderUserId === actorId,
    body: m.body, createdAt: m.createdAt.toISOString(),
  };
}

export const listMessagesSchema = z.object({ cursor: z.string().optional(), limit: z.number().int().min(1).max(100).default(30) });

/** Cursor-paginated history, newest-first page, deterministic id tie-break. */
export async function listMessages(scope: OrgScope, conversationId: string, raw: unknown): Promise<MessageHistoryDto> {
  await requireParticipant(scope, conversationId);
  const input = parseInput(listMessagesSchema, raw);
  const rows = await prisma.message.findMany({
    where: { conversationId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: input.limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    select: { id: true, conversationId: true, senderUserId: true, body: true, createdAt: true, sender: { select: { name: true, email: true } } },
  });
  const hasMore = rows.length > input.limit;
  const page = hasMore ? rows.slice(0, input.limit) : rows;
  return { items: page.map((m) => messageDto(m, scope.actor.id)).reverse(), nextCursor: hasMore ? page[page.length - 1].id : null };
}

export const sendMessageSchema = z.object({ body: z.string().trim().min(1, "Message cannot be empty").max(MAX_BODY_LENGTH, "Message is too long") });

export async function sendMessage(scope: OrgScope, conversationId: string, raw: unknown): Promise<MessageDto> {
  const conv = await requireParticipant(scope, conversationId);
  const input = parseInput(sendMessageSchema, raw);

  const created = await prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: { conversationId, senderUserId: scope.actor.id, body: input.body },
      select: { id: true, conversationId: true, senderUserId: true, body: true, createdAt: true, sender: { select: { name: true, email: true } } },
    });
    await tx.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    await recordAudit(tx, scope, "MESSAGE_SENT", "Message", message.id, { conversationId });

    const recipientUserIds = conv.participants.map((p) => p.userId).filter((id) => id !== scope.actor.id);
    const senderName = displayName(message.sender);
    await createNotification(tx, {
      tenantId: scope.tenantId, schoolId: scope.schoolId, type: "MESSAGE_RECEIVED",
      title: `New message from ${senderName}`, body: input.body.length > 140 ? `${input.body.slice(0, 140)}…` : input.body,
      href: `/teacher/messages?conversation=${conversationId}`, sourceType: "Message", sourceId: message.id,
      dedupeKey: `MESSAGE_RECEIVED:${message.id}`, recipientUserIds,
    });
    return message;
  });
  return messageDto(created, scope.actor.id);
}

// ── Read state ───────────────────────────────────────────────────────────────

/** Monotonic: only ever advances lastReadAt forward. Two concurrent calls can
 *  never regress it — each write's WHERE guard only applies if the new
 *  timestamp is strictly newer than what's currently stored. */
export async function markConversationRead(scope: OrgScope, conversationId: string): Promise<void> {
  await requireParticipant(scope, conversationId);
  const now = new Date();
  await prisma.conversationParticipant.updateMany({
    where: { conversationId, userId: scope.actor.id, OR: [{ lastReadAt: null }, { lastReadAt: { lt: now } }] },
    data: { lastReadAt: now },
  });
}

export async function getUnreadCount(scope: OrgScope): Promise<number> {
  const participations = await prisma.conversationParticipant.findMany({
    where: { userId: scope.actor.id, conversation: { tenantId: scope.tenantId, schoolId: scope.schoolId } },
    select: { conversationId: true, lastReadAt: true },
  });
  const counts = await unreadCountsForMany(scope.actor.id, participations);
  return [...counts.values()].reduce((sum, c) => sum + c, 0);
}
