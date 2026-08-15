import { getSnapshot, setState } from "@/lib/data/store";
import type {
  Announcement,
  Broadcast,
  CommChannel,
  ConversationCategory,
  GatePassStatus,
  Message,
  NotificationSettings,
  TicketPriority,
  TicketStatus,
  VisitorStatus,
  VisitorType,
} from "@/lib/types/communication";
import { ME_ID } from "@/lib/data/seed/communication";
import { generateId } from "@/lib/utils";

type Result = { ok: true } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Conversations & messages
// ---------------------------------------------------------------------------

export function sendMessage(conversationId: string, body: string, options?: { internal?: boolean }): Result & { message?: Message } {
  if (!body.trim()) return { ok: false, error: "Message cannot be empty." };
  const db = getSnapshot();
  const conv = db.conversations.find((c) => c.id === conversationId);
  if (!conv) return { ok: false, error: "Conversation not found." };
  const now = new Date().toISOString();
  const message: Message = { id: generateId("msg"), conversationId, senderId: ME_ID, fromMe: true, body: body.trim(), attachments: [], internal: options?.internal ?? false, delivery: "delivered", sentAt: now };
  setState((current) => ({
    ...current,
    messages: [...current.messages, message],
    conversations: current.conversations.map((c) => (c.id === conversationId ? { ...c, lastMessagePreview: options?.internal ? "Internal note added" : message.body, lastMessageAt: now } : c)),
  }));
  return { ok: true, message };
}

export function markConversationRead(conversationId: string): Result {
  setState((db) => ({ ...db, conversations: db.conversations.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)) }));
  return { ok: true };
}

export function setConversationStatus(conversationId: string, status: "open" | "resolved" | "archived"): Result {
  setState((db) => ({ ...db, conversations: db.conversations.map((c) => (c.id === conversationId ? { ...c, status } : c)) }));
  return { ok: true };
}

export function setConversationFollowUp(conversationId: string, date: string | undefined): Result {
  setState((db) => ({ ...db, conversations: db.conversations.map((c) => (c.id === conversationId ? { ...c, nextFollowUpAt: date } : c)) }));
  return { ok: true };
}

export function setConversationCategory(conversationId: string, category: ConversationCategory): Result {
  setState((db) => ({ ...db, conversations: db.conversations.map((c) => (c.id === conversationId ? { ...c, category } : c)) }));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Announcements & notices
// ---------------------------------------------------------------------------

export type AnnouncementDraft = Omit<Announcement, "id" | "sentCount" | "seenCount" | "acknowledgedCount" | "createdAt">;

export function createAnnouncement(draft: AnnouncementDraft): Result & { announcement?: Announcement } {
  if (!draft.title.trim()) return { ok: false, error: "Title is required." };
  const now = new Date().toISOString();
  const announcement: Announcement = { ...draft, id: generateId("ann"), sentCount: 0, seenCount: 0, acknowledgedCount: 0, createdAt: now };
  setState((db) => ({ ...db, commAnnouncements: [announcement, ...db.commAnnouncements] }));
  return { ok: true, announcement };
}

export function setAnnouncementStatus(id: string, status: Announcement["status"]): Result {
  const db = getSnapshot();
  const ann = db.commAnnouncements.find((a) => a.id === id);
  if (!ann) return { ok: false, error: "Announcement not found." };
  // Publishing simulates a send to the audience.
  const patch = status === "published" && ann.status !== "published" ? { status, sentCount: ann.sentCount || 1248, seenCount: ann.seenCount || 0 } : { status };
  setState((current) => ({ ...current, commAnnouncements: current.commAnnouncements.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
  return { ok: true };
}

export function remindPendingAnnouncement(id: string): Result {
  const db = getSnapshot();
  const ann = db.commAnnouncements.find((a) => a.id === id);
  if (!ann) return { ok: false, error: "Announcement not found." };
  return { ok: true };
}

export function setNoticeStatus(id: string, status: Announcement["status"]): Result {
  setState((db) => ({ ...db, commNotices: db.commNotices.map((n) => (n.id === id ? { ...n, status } : n)) }));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Broadcasts
// ---------------------------------------------------------------------------

export type BroadcastDraft = { title: string; message: string; audience: Broadcast["audience"]; audienceTarget?: string; channels: CommChannel[]; estimatedRecipients: number; scheduledAt?: string };

export function createBroadcast(draft: BroadcastDraft, send: boolean): Result & { broadcast?: Broadcast } {
  if (!draft.title.trim()) return { ok: false, error: "Broadcast title is required." };
  if (!draft.message.trim()) return { ok: false, error: "Message is required." };
  if (draft.channels.length === 0) return { ok: false, error: "Select at least one channel." };
  const now = new Date().toISOString();
  // Only in-app is a live channel; other channels report as demo (no real delivery).
  const delivered = send ? Math.round(draft.estimatedRecipients * 0.97) : 0;
  const broadcast: Broadcast = {
    id: generateId("bc"),
    title: draft.title.trim(),
    message: draft.message.trim(),
    audience: draft.audience,
    audienceTarget: draft.audienceTarget,
    channels: draft.channels,
    status: send ? "sent" : draft.scheduledAt ? "scheduled" : "draft",
    estimatedRecipients: draft.estimatedRecipients,
    deliveredCount: delivered,
    failedCount: send ? draft.estimatedRecipients - delivered : 0,
    scheduledAt: draft.scheduledAt,
    sentAt: send ? now : undefined,
    createdBy: "Communication Admin",
    createdAt: now,
  };
  setState((db) => ({ ...db, commBroadcasts: [broadcast, ...db.commBroadcasts] }));
  return { ok: true, broadcast };
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
// Phase 9D.2 — the real in-app Notification list/mark-read live at
// lib/server/notifications/service.ts + /api/notifications/*. This mock
// commNotifications-mutating trio (markNotificationRead/markAllNotifications-
// Read/archiveNotification) was deleted — zero remaining consumers after
// app/notifications/page.tsx cut over. Preferences (channel toggles below)
// remain mock — no email/SMS/push infra exists yet (V1 is in-app only).

export function updateNotificationSettings(patch: Partial<NotificationSettings>): Result {
  setState((db) => ({ ...db, notificationSettings: { ...db.notificationSettings, ...patch } }));
  return { ok: true };
}

export function toggleNotificationChannel(module: string, channel: CommChannel): Result {
  setState((db) => ({
    ...db,
    notificationSettings: {
      ...db.notificationSettings,
      preferences: db.notificationSettings.preferences.map((p) => (p.module === module ? { ...p, channels: { ...p.channels, [channel]: !p.channels[channel] } } : p)),
    },
  }));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Helpdesk
// ---------------------------------------------------------------------------

export function replyToTicket(ticketId: string, body: string, internal: boolean): Result {
  if (!body.trim()) return { ok: false, error: "Reply cannot be empty." };
  const db = getSnapshot();
  const ticket = db.helpdeskTickets.find((t) => t.id === ticketId);
  if (!ticket) return { ok: false, error: "Ticket not found." };
  const now = new Date().toISOString();
  setState((current) => ({
    ...current,
    ticketReplies: [...current.ticketReplies, { id: generateId("rep"), ticketId, authorName: "Support Agent", fromStaff: true, internal, body: body.trim(), createdAt: now }],
    helpdeskTickets: current.helpdeskTickets.map((t) => (t.id === ticketId ? { ...t, lastActivityAt: now, status: !internal && t.status === "new" ? "open" : t.status } : t)),
  }));
  return { ok: true };
}

export function setTicketStatus(ticketId: string, status: TicketStatus): Result {
  const now = new Date().toISOString();
  setState((db) => ({ ...db, helpdeskTickets: db.helpdeskTickets.map((t) => (t.id === ticketId ? { ...t, status, lastActivityAt: now } : t)) }));
  return { ok: true };
}

export function setTicketPriority(ticketId: string, priority: TicketPriority): Result {
  setState((db) => ({ ...db, helpdeskTickets: db.helpdeskTickets.map((t) => (t.id === ticketId ? { ...t, priority } : t)) }));
  return { ok: true };
}

export function assignTicket(ticketId: string, assignee: string): Result {
  setState((db) => ({ ...db, helpdeskTickets: db.helpdeskTickets.map((t) => (t.id === ticketId ? { ...t, assignedTo: assignee, status: t.status === "new" ? "open" : t.status } : t)) }));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Front desk
// ---------------------------------------------------------------------------

export type VisitorDraft = { name: string; phone: string; organization?: string; purpose: string; hostName: string; department: string; type: VisitorType; vehicleNumber?: string };

export function checkInVisitor(draft: VisitorDraft): Result & { visitorId?: string } {
  if (!draft.name.trim()) return { ok: false, error: "Visitor name is required." };
  if (!draft.hostName.trim()) return { ok: false, error: "Select a host to meet." };
  const db = getSnapshot();
  const now = new Date();
  const visitor = {
    id: generateId("vis"),
    visitorNumber: `V-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${String(db.visitors.length + 1).padStart(3, "0")}`,
    name: draft.name.trim(),
    phone: draft.phone,
    organization: draft.organization,
    purpose: draft.purpose,
    hostName: draft.hostName,
    department: draft.department,
    type: draft.type,
    date: now.toISOString().slice(0, 10),
    arrivalTime: now.toTimeString().slice(0, 5),
    vehicleNumber: draft.vehicleNumber,
    badgeCode: `BADGE${Math.floor(1000 + Math.random() * 9000)}`,
    status: "checked-in" as VisitorStatus,
    createdAt: now.toISOString(),
  };
  setState((current) => ({ ...current, visitors: [visitor, ...current.visitors] }));
  return { ok: true, visitorId: visitor.id };
}

export function setVisitorStatus(visitorId: string, status: VisitorStatus): Result {
  const now = new Date();
  setState((db) => ({
    ...db,
    visitors: db.visitors.map((v) => (v.id === visitorId ? { ...v, status, departureTime: status === "checked-out" ? now.toTimeString().slice(0, 5) : v.departureTime, arrivalTime: status === "checked-in" && !v.arrivalTime ? now.toTimeString().slice(0, 5) : v.arrivalTime } : v)),
  }));
  return { ok: true };
}

export function setGatePassStatus(gatePassId: string, status: GatePassStatus, authorizedBy?: string): Result {
  setState((db) => ({ ...db, gatePasses: db.gatePasses.map((g) => (g.id === gatePassId ? { ...g, status, authorizedBy: authorizedBy ?? g.authorizedBy } : g)) }));
  return { ok: true };
}

export function markDeliveryCollected(deliveryId: string): Result {
  const now = new Date();
  setState((db) => ({ ...db, deliveries: db.deliveries.map((d) => (d.id === deliveryId ? { ...d, status: "collected", collectedAt: now.toTimeString().slice(0, 5) } : d)) }));
  return { ok: true };
}

export function setCallFollowUp(callId: string, done: boolean): Result {
  setState((db) => ({ ...db, receptionCalls: db.receptionCalls.map((c) => (c.id === callId ? { ...c, followUpNeeded: !done } : c)) }));
  return { ok: true };
}
