import { getSnapshot, setState } from "@/lib/data/store";
import type { ReminderRule } from "@/lib/types/fees";
import { generateId } from "@/lib/utils";
import { logFinancialAudit } from "./finance-audit-service";

type Actor = { name: string; role: string };

export type ReminderRuleDraft = Omit<ReminderRule, "id" | "createdAt" | "updatedAt" | "status">;

export function createReminderRule(draft: ReminderRuleDraft, actor: Actor): ReminderRule {
  const now = new Date().toISOString();
  const rule: ReminderRule = { ...draft, id: generateId("rem"), status: "active", createdAt: now, updatedAt: now };
  setState((db) => ({ ...db, reminderRules: [...db.reminderRules, rule] }));
  logFinancialAudit({ action: "reminder-rule-changed", actorName: actor.name, actorRole: actor.role, summary: `Reminder rule "${rule.name}" created.` });
  return rule;
}

export function updateReminderRule(ruleId: string, patch: Partial<ReminderRuleDraft>, actor: Actor) {
  const rule = getSnapshot().reminderRules.find((r) => r.id === ruleId);
  setState((db) => ({ ...db, reminderRules: db.reminderRules.map((r) => (r.id === ruleId ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r)) }));
  if (rule) logFinancialAudit({ action: "reminder-rule-changed", actorName: actor.name, actorRole: actor.role, summary: `Reminder rule "${rule.name}" updated.` });
}

export function setReminderRuleStatus(ruleId: string, status: ReminderRule["status"], actor: Actor) {
  const rule = getSnapshot().reminderRules.find((r) => r.id === ruleId);
  setState((db) => ({ ...db, reminderRules: db.reminderRules.map((r) => (r.id === ruleId ? { ...r, status, updatedAt: new Date().toISOString() } : r)) }));
  if (rule) logFinancialAudit({ action: "reminder-rule-changed", actorName: actor.name, actorRole: actor.role, summary: `Reminder rule "${rule.name}" marked ${status}.` });
}

export function deleteReminderRule(ruleId: string, actor: Actor) {
  const rule = getSnapshot().reminderRules.find((r) => r.id === ruleId);
  setState((db) => ({ ...db, reminderRules: db.reminderRules.filter((r) => r.id !== ruleId) }));
  if (rule) logFinancialAudit({ action: "reminder-rule-changed", actorName: actor.name, actorRole: actor.role, summary: `Reminder rule "${rule.name}" deleted.` });
}

/** Fills {studentName}/{amount}/{dueDate} placeholders with sample values so
 * an admin can see exactly what a message will look like before turning a
 * rule on or sending a bulk batch — the spec's "preview before bulk
 * sending" requirement. */
export function previewTemplate(template: string, sample: { studentName: string; amount: string; dueDate: string }): string {
  return template.replace(/\{studentName\}/g, sample.studentName).replace(/\{amount\}/g, sample.amount).replace(/\{dueDate\}/g, sample.dueDate);
}
