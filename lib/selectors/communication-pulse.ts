import type { Db } from "@/lib/data/store";

export type CommPulseFactor = { key: string; label: string; score: number; displayValue: string; tone: "success" | "warning" | "error" };
export type CommPulse = { score: number; factors: CommPulseFactor[] };

function toneFor(score: number): "success" | "warning" | "error" {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "error";
}

/** Composite 0-100 communication-health score from live mock state. */
export function computeCommPulse(db: Db): CommPulse {
  const open = db.conversations.filter((c) => c.status === "open");
  const replied = open.filter((c) => c.unreadCount === 0).length;
  const responseScore = open.length > 0 ? Math.round((replied / open.length) * 100) : 100;

  const urgentUnread = db.conversations.filter((c) => c.priority === "urgent" && c.unreadCount > 0).length;
  const criticalScore = Math.max(0, 100 - urgentUnread * 20);

  // Parent response readiness — inverse of overdue follow-ups.
  const today = new Date().toISOString().slice(0, 10);
  const overdueFollowUps = db.conversations.filter((c) => c.nextFollowUpAt && c.nextFollowUpAt < today).length;
  const followUpScore = Math.max(0, 100 - overdueFollowUps * 12);

  const ackItems = [...db.commAnnouncements, ...db.commNotices].filter((a) => a.acknowledgementRequired && a.sentCount > 0);
  const totalSent = ackItems.reduce((s, a) => s + a.sentCount, 0);
  const totalAck = ackItems.reduce((s, a) => s + a.acknowledgedCount, 0);
  const ackScore = totalSent > 0 ? Math.round((totalAck / totalSent) * 100) : 100;

  const sentBroadcasts = db.commBroadcasts.filter((b) => b.status === "sent");
  const totalDelivered = sentBroadcasts.reduce((s, b) => s + b.deliveredCount, 0);
  const totalAttempted = sentBroadcasts.reduce((s, b) => s + b.deliveredCount + b.failedCount, 0);
  const deliveryScore = totalAttempted > 0 ? Math.round((totalDelivered / totalAttempted) * 100) : 100;

  const openTickets = db.helpdeskTickets.filter((t) => t.status !== "resolved" && t.status !== "closed");
  const ticketScore = db.helpdeskTickets.length > 0 ? Math.round((1 - openTickets.length / db.helpdeskTickets.length) * 100) : 100;

  const activeEmergency = db.commAnnouncements.some((a) => a.category === "emergency-notice" && a.status === "published");
  const emergencyScore = activeEmergency ? 40 : 100;

  const factors: CommPulseFactor[] = [
    { key: "response", label: "Response rate", score: responseScore, displayValue: `${responseScore}%`, tone: toneFor(responseScore) },
    { key: "critical", label: "Unread critical", score: criticalScore, displayValue: `${urgentUnread} urgent`, tone: toneFor(criticalScore) },
    { key: "followup", label: "Follow-up health", score: followUpScore, displayValue: `${overdueFollowUps} overdue`, tone: toneFor(followUpScore) },
    { key: "ack", label: "Notice acknowledgement", score: ackScore, displayValue: `${ackScore}%`, tone: toneFor(ackScore) },
    { key: "delivery", label: "Delivery success", score: deliveryScore, displayValue: `${totalAttempted - totalDelivered} failed`, tone: toneFor(deliveryScore) },
    { key: "tickets", label: "Ticket load", score: ticketScore, displayValue: `${openTickets.length} open`, tone: toneFor(ticketScore) },
    { key: "emergency", label: "Emergency status", score: emergencyScore, displayValue: activeEmergency ? "Active" : "Clear", tone: toneFor(emergencyScore) },
  ];

  const score = Math.max(0, Math.min(100, Math.round(factors.reduce((sum, f) => sum + f.score, 0) / factors.length)));
  return { score, factors };
}
