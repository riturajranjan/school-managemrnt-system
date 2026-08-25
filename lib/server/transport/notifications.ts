// Transport Notifications — reuses the real Phase 9D Notification engine
// verbatim (type=TRANSPORT_ALERT, sourceType="transport"). Staff-linked User
// recipients only — Student/Guardian have no linked User account in this
// system, so parents can never be a real recipient. No SMS/WhatsApp/push
// simulation (the real engine is in-app only), no rule/trigger automation
// engine — sending is always an explicit, manual action.
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { TransportNotificationDto } from "@/lib/api/contracts";
import { createNotification } from "@/lib/server/notifications/service";

export async function listTransportNotifications(scope: OrgScope): Promise<TransportNotificationDto[]> {
  const rows = await prisma.notification.findMany({
    where: { schoolId: scope.schoolId, type: "TRANSPORT_ALERT", sourceType: "transport" },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, body: true, createdAt: true, recipients: { select: { readAt: true } } },
  });
  return rows.map((r) => ({
    id: r.id, title: r.title, body: r.body, createdAt: r.createdAt.toISOString(),
    recipientCount: r.recipients.length, readCount: r.recipients.filter((rc) => rc.readAt).length,
  }));
}

export const sendTransportNotificationSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(1000),
  recipientStaffIds: z.array(z.string().min(1)).min(1),
});

/** Sends only to recipients who are real Staff with a linked User account —
 *  silently drops the rest rather than pretending they were notified. */
export async function sendTransportNotification(scope: OrgScope, raw: unknown): Promise<{ sentTo: number; skipped: number }> {
  const input = parseInput(sendTransportNotificationSchema, raw);
  const staff = await prisma.staff.findMany({
    where: { id: { in: input.recipientStaffIds }, schoolId: scope.schoolId },
    select: { id: true, userId: true },
  });
  const recipientUserIds = staff.map((s) => s.userId).filter((id): id is string => Boolean(id));
  if (recipientUserIds.length === 0) throw new HttpError("VALIDATION_ERROR", "None of the selected staff have a linked user account to notify");

  await prisma.$transaction(async (tx) => {
    await createNotification(tx, {
      tenantId: scope.tenantId, schoolId: scope.schoolId, type: "TRANSPORT_ALERT", title: input.title, body: input.body,
      sourceType: "transport", dedupeKey: `TRANSPORT_ALERT:${randomUUID()}`, recipientUserIds,
    });
    await recordAudit(tx, scope, "TRANSPORT_NOTIFICATION_SENT", "Notification", input.title, { recipientCount: recipientUserIds.length });
  });
  return { sentTo: recipientUserIds.length, skipped: input.recipientStaffIds.length - recipientUserIds.length };
}
