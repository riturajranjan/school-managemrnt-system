import { getSnapshot, setState } from "@/lib/data/store";
import type { TransportNotification, TransportNotificationChannel, TransportNotificationRule, TransportNotificationTrigger } from "@/lib/types/transport";
import { generateId } from "@/lib/utils";
import { logTransportAudit } from "./transport-audit-service";

type Actor = { name: string; role: string };
type Result = { ok: true } | { ok: false; error: string };

export type NotificationRuleDraft = Omit<TransportNotificationRule, "id" | "createdAt" | "updatedAt" | "status">;

export function createNotificationRule(draft: NotificationRuleDraft, actor: Actor): TransportNotificationRule {
  const now = new Date().toISOString();
  const rule: TransportNotificationRule = { ...draft, id: generateId("tnr"), status: "active", createdAt: now, updatedAt: now };
  setState((db) => ({ ...db, transportNotificationRules: [...db.transportNotificationRules, rule] }));
  logTransportAudit({ subjectId: rule.id, action: "notification-sent", actorName: actor.name, actorRole: actor.role, summary: `Notification rule "${rule.name}" created.` });
  return rule;
}

export function updateNotificationRule(ruleId: string, patch: Partial<NotificationRuleDraft>, actor: Actor): Result {
  const db = getSnapshot();
  const rule = db.transportNotificationRules.find((r) => r.id === ruleId);
  if (!rule) return { ok: false, error: "Rule not found." };

  setState((current) => ({ ...current, transportNotificationRules: current.transportNotificationRules.map((r) => (r.id === ruleId ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r)) }));
  logTransportAudit({ subjectId: ruleId, action: "notification-sent", actorName: actor.name, actorRole: actor.role, summary: `Notification rule "${rule.name}" updated.` });
  return { ok: true };
}

export function setNotificationRuleStatus(ruleId: string, status: "active" | "inactive", actor: Actor): Result {
  const db = getSnapshot();
  const rule = db.transportNotificationRules.find((r) => r.id === ruleId);
  if (!rule) return { ok: false, error: "Rule not found." };

  setState((current) => ({ ...current, transportNotificationRules: current.transportNotificationRules.map((r) => (r.id === ruleId ? { ...r, status, updatedAt: new Date().toISOString() } : r)) }));
  logTransportAudit({ subjectId: ruleId, action: "notification-sent", actorName: actor.name, actorRole: actor.role, summary: `Notification rule "${rule.name}" marked ${status}.` });
  return { ok: true };
}

/** Fills {studentName}/{routeName}/{stopName}/{delayMinutes}/etc. placeholders
 * with sample values — the same "preview before bulk sending" pattern as
 * Phase 5's reminder templates. */
export function previewNotificationTemplate(template: string, sample: Record<string, string>): string {
  return Object.entries(sample).reduce((message, [key, value]) => message.replaceAll(`{${key}}`, value), template);
}

export type SendNotificationInput = {
  trigger: TransportNotificationTrigger;
  channel: TransportNotificationChannel;
  audience: TransportNotificationRule["audience"];
  recipientId: string;
  studentId?: string;
  tripId?: string;
  message: string;
  ruleId?: string;
};

/** Simulated send — no real SMS/WhatsApp/email gateway is wired up in this
 * demo (same disclosed pattern as Phase 5's payment-gateway simulation).
 * Writes a real TransportNotification record either way, so the log and
 * the parent/student "Notifications" views stay truthful. */
export function sendTransportNotification(input: SendNotificationInput, actor: Actor): TransportNotification {
  const notification: TransportNotification = { ...input, id: generateId("tnotif"), sentAt: new Date().toISOString(), status: "sent" };
  setState((db) => ({ ...db, transportNotifications: [...db.transportNotifications, notification] }));
  logTransportAudit({ subjectId: input.studentId, action: "notification-sent", actorName: actor.name, actorRole: actor.role, summary: `${input.trigger.replace(/-/g, " ")} notification sent via ${input.channel}.`, tripId: input.tripId });
  return notification;
}

/** Sends the same message to every rule-configured channel for a trigger —
 * used when a rule fires for a real event (e.g. bus departed). */
export function dispatchRuleNotification(rule: TransportNotificationRule, recipientId: string, sample: Record<string, string>, actor: Actor, context?: { studentId?: string; tripId?: string }): TransportNotification[] {
  const message = previewNotificationTemplate(rule.templateEn, sample);
  return rule.channels.map((channel) => sendTransportNotification({ trigger: rule.trigger, channel, audience: rule.audience, recipientId, studentId: context?.studentId, tripId: context?.tripId, message, ruleId: rule.id }, actor));
}
