import type { Db } from "@/lib/data/store";

export type CommSummary = {
  unread: number;
  priority: number;
  parentMessages: number;
  staffMessages: number;
  scheduledAnnouncements: number;
  noticesAwaitingAck: number;
  openTickets: number;
  urgentTickets: number;
  visitorsToday: number;
  appointmentsToday: number;
};

const TODAY = () => new Date().toISOString().slice(0, 10);

export function commSummary(db: Db): CommSummary {
  const today = TODAY();
  const parentConvIds = new Set(db.conversationParticipants.filter((p) => p.role === "parent").map((p) => p.id));
  return {
    unread: db.conversations.reduce((s, c) => s + c.unreadCount, 0),
    priority: db.conversations.filter((c) => (c.priority === "priority" || c.priority === "urgent") && c.status === "open").length,
    parentMessages: db.conversations.filter((c) => parentConvIds.has(c.counterpartId) && c.status === "open").length,
    staffMessages: db.conversations.filter((c) => !parentConvIds.has(c.counterpartId) && c.status === "open").length,
    scheduledAnnouncements: db.commAnnouncements.filter((a) => a.status === "scheduled").length,
    noticesAwaitingAck: [...db.commNotices, ...db.commAnnouncements].filter((n) => n.acknowledgementRequired && n.status === "published" && n.acknowledgedCount < n.sentCount).length,
    openTickets: db.helpdeskTickets.filter((t) => t.status !== "resolved" && t.status !== "closed").length,
    urgentTickets: db.helpdeskTickets.filter((t) => t.priority === "urgent" && t.status !== "resolved" && t.status !== "closed").length,
    visitorsToday: db.visitors.filter((v) => v.date === today).length,
    appointmentsToday: db.visitorAppointments.filter((a) => a.date === today).length,
  };
}

export type CommActionItem = { id: string; label: string; detail: string; tone: "error" | "warning" | "info" | "success" | "neutral"; href: string };

/** "What requires action now?" feed for the Communication Command Centre. */
export function commActionItems(db: Db): CommActionItem[] {
  const today = TODAY();
  const items: CommActionItem[] = [];

  const urgentUnread = db.conversations.filter((c) => c.priority === "urgent" && c.unreadCount > 0);
  if (urgentUnread.length > 0) items.push({ id: "urgent-msg", label: `${urgentUnread.length} urgent message(s) unread`, detail: "Parents awaiting a reply", tone: "error", href: "/communication/inbox" });

  const failed = db.commBroadcasts.filter((b) => b.status === "sent" && b.failedCount > 0);
  if (failed.length > 0) items.push({ id: "failed", label: `${failed.reduce((s, b) => s + b.failedCount, 0)} failed deliveries`, detail: "Demo channels — review recipients", tone: "warning", href: "/communication/broadcasts" });

  const urgentTickets = db.helpdeskTickets.filter((t) => t.priority === "urgent" && t.status !== "resolved" && t.status !== "closed");
  if (urgentTickets.length > 0) items.push({ id: "urgent-tickets", label: `${urgentTickets.length} urgent ticket(s)`, detail: "Escalated or high-priority support", tone: "error", href: "/helpdesk/tickets" });

  const pendingAck = [...db.commNotices, ...db.commAnnouncements].filter((n) => n.acknowledgementRequired && n.status === "published" && n.acknowledgedCount < n.sentCount);
  if (pendingAck.length > 0) items.push({ id: "ack", label: `${pendingAck.length} notice(s) awaiting acknowledgement`, detail: "Send a reminder to pending recipients", tone: "warning", href: "/communication/notices" });

  const waitingVisitors = db.visitors.filter((v) => v.status === "waiting");
  if (waitingVisitors.length > 0) items.push({ id: "visitors", label: `${waitingVisitors.length} visitor(s) waiting`, detail: "Front desk — check in or notify host", tone: "info", href: "/front-desk/visitors" });

  const pendingPasses = db.gatePasses.filter((g) => g.status === "requested");
  if (pendingPasses.length > 0) items.push({ id: "passes", label: `${pendingPasses.length} gate pass(es) to approve`, detail: "Pending authorisation", tone: "warning", href: "/front-desk/gate-passes" });

  const emergency = db.commAnnouncements.filter((a) => a.category === "emergency-notice" && a.status === "published");
  if (emergency.length > 0) items.push({ id: "emergency", label: `${emergency.length} active emergency notice`, detail: "Ongoing emergency communication", tone: "error", href: "/communication/emergency" });

  const followUps = db.conversations.filter((c) => c.nextFollowUpAt && c.nextFollowUpAt <= today && c.status === "open");
  if (followUps.length > 0) items.push({ id: "followups", label: `${followUps.length} follow-up(s) due`, detail: "Scheduled parent follow-ups", tone: "info", href: "/communication/parents" });

  const rank = { error: 0, warning: 1, info: 2, success: 3, neutral: 4 };
  return items.sort((a, b) => rank[a.tone] - rank[b.tone]);
}
