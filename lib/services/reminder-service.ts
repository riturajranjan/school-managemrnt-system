import { setState } from "@/lib/data/store";
import type { ReminderChannel, ReminderLog } from "@/lib/types/fees";
import { generateId } from "@/lib/utils";
import { logFinancialAudit } from "./finance-audit-service";

type Actor = { name: string; role: string };

/** No SMS/email/WhatsApp/push backend exists in this demo — sending is
 * simulated by recording a ReminderLog row (visible in the dues workspace's
 * "reminder status" column) rather than dispatching anything real. */
export function sendManualReminder(studentId: string, channel: ReminderChannel, actor: Actor): ReminderLog {
  const log: ReminderLog = { id: generateId("reml"), studentId, channel, sentAt: new Date().toISOString(), sentBy: actor.name };
  setState((db) => ({ ...db, reminderLog: [log, ...db.reminderLog] }));
  logFinancialAudit({ subjectId: studentId, action: "manual-override-used", actorName: actor.name, actorRole: actor.role, summary: `Reminder sent via ${channel} (simulated).` });
  return log;
}

export function sendBulkReminders(studentIds: string[], channel: ReminderChannel, actor: Actor): ReminderLog[] {
  return studentIds.map((studentId) => sendManualReminder(studentId, channel, actor));
}
