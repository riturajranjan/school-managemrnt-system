// In-app Notifications (Phase 9D.2) — real, PostgreSQL-backed. V1 is in-app
// only (no email/SMS/push). One Notification row per logical event, fanned
// out to real NotificationRecipient rows (real User rows only, reached via
// Staff.userId — Student/Guardian have no linked User account in this system
// yet, so they can never be recipients). Read state is per-recipient
// (NotificationRecipient.readAt), never a single shared flag.
//
// DEDUPE: `dedupeKey` is unique and stable per logical event (e.g.
// "LESSON_PLAN_APPROVED:<lessonPlanId>", "EXAM_SCHEDULED:<scheduleEntryId>").
// createNotification() is called from inside the SAME transaction as the
// triggering mutation (approve/reject/schedule/calendar-create); on a retried
// request the unique constraint makes the second attempt a no-op via
// `skipDuplicates`-style catch, so a notification (and its recipient fanout)
// is created at most once per logical event even under concurrent retries.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ListMeta } from "@/lib/server/api/response";
import type { NotificationDto, NotificationTypeDto } from "@/lib/api/contracts";

const TYPE_TO_UI: Record<string, NotificationTypeDto> = {
  LESSON_PLAN_APPROVED: "lesson-plan-approved",
  LESSON_PLAN_REJECTED: "lesson-plan-rejected",
  EXAM_SCHEDULED: "exam-scheduled",
  CALENDAR_EVENT: "calendar-event",
  LEAVE_REQUEST_SUBMITTED: "leave-request-submitted",
  LEAVE_REQUEST_APPROVED: "leave-request-approved",
  LEAVE_REQUEST_REJECTED: "leave-request-rejected",
  VISITOR_CHECKED_IN: "visitor-checked-in",
  MESSAGE_RECEIVED: "message-received",
  LIBRARY_BOOK_ISSUED: "library-book-issued",
  LIBRARY_BOOK_RETURNED: "library-book-returned",
  ASSET_ASSIGNED: "asset-assigned",
  ASSET_RETURNED: "asset-returned",
  COUNSELING_CASE_ASSIGNED: "counseling-case-assigned",
  ACTIVITY_STAFF_ASSIGNED: "activity-staff-assigned",
  TRANSPORT_ALERT: "transport-alert",
};

type CreateNotificationInput = {
  tenantId: string;
  schoolId: string;
  type: "LESSON_PLAN_APPROVED" | "LESSON_PLAN_REJECTED" | "EXAM_SCHEDULED" | "CALENDAR_EVENT" | "LEAVE_REQUEST_SUBMITTED" | "LEAVE_REQUEST_APPROVED" | "LEAVE_REQUEST_REJECTED" | "VISITOR_CHECKED_IN" | "MESSAGE_RECEIVED" | "LIBRARY_BOOK_ISSUED" | "LIBRARY_BOOK_RETURNED" | "ASSET_ASSIGNED" | "ASSET_RETURNED" | "COUNSELING_CASE_ASSIGNED" | "ACTIVITY_STAFF_ASSIGNED" | "TRANSPORT_ALERT";
  title: string;
  body: string;
  href?: string | null;
  sourceType?: string;
  sourceId?: string;
  dedupeKey: string;
  recipientUserIds: string[];
};

/**
 * Create a Notification + fan it out to real recipients. Idempotent on
 * dedupeKey: if the notification already exists (retry/duplicate trigger),
 * this only ensures the recipient rows exist — it never creates a second
 * Notification row or double-notifies a recipient. No-ops (returns silently)
 * when recipientUserIds is empty — nothing to notify, nothing worth a row for.
 */
export async function createNotification(db: Prisma.TransactionClient, input: CreateNotificationInput): Promise<void> {
  const recipients = [...new Set(input.recipientUserIds)];
  if (recipients.length === 0) return;

  const notification = await db.notification.upsert({
    where: { dedupeKey: input.dedupeKey },
    create: {
      tenantId: input.tenantId, schoolId: input.schoolId, type: input.type,
      title: input.title, body: input.body, href: input.href ?? null,
      sourceType: input.sourceType ?? null, sourceId: input.sourceId ?? null,
      dedupeKey: input.dedupeKey,
    },
    update: {},
    select: { id: true },
  });

  await db.notificationRecipient.createMany({
    data: recipients.map((userId) => ({ notificationId: notification.id, userId })),
    skipDuplicates: true,
  });
}

function notificationDto(row: { id: string; type: string; title: string; body: string; href: string | null; createdAt: Date; recipients: { readAt: Date | null }[] }): NotificationDto {
  return {
    id: row.id,
    type: TYPE_TO_UI[row.type] ?? "calendar-event",
    title: row.title,
    body: row.body,
    href: row.href,
    createdAt: row.createdAt.toISOString(),
    readAt: row.recipients[0]?.readAt?.toISOString() ?? null,
  };
}

export const listNotificationsSchema = z.object({
  unreadOnly: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export async function listMyNotifications(scope: OrgScope, raw: unknown): Promise<{ data: NotificationDto[]; meta: ListMeta }> {
  const input = parseInput(listNotificationsSchema, raw);
  const where: Prisma.NotificationRecipientWhereInput = {
    userId: scope.actor.id,
    ...(input.unreadOnly ? { readAt: null } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.notificationRecipient.count({ where }),
    prisma.notificationRecipient.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: { readAt: true, notification: { select: { id: true, type: true, title: true, body: true, href: true, createdAt: true } } },
    }),
  ]);
  const data = rows.map((r) => notificationDto({ ...r.notification, recipients: [{ readAt: r.readAt }] }));
  return { data, meta: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.max(1, Math.ceil(total / input.pageSize)) } };
}

export async function getUnreadCount(scope: OrgScope): Promise<number> {
  return prisma.notificationRecipient.count({ where: { userId: scope.actor.id, readAt: null } });
}

export async function markNotificationRead(scope: OrgScope, notificationId: string): Promise<void> {
  const result = await prisma.notificationRecipient.updateMany({
    where: { notificationId, userId: scope.actor.id, readAt: null },
    data: { readAt: new Date() },
  });
  if (result.count === 0) {
    const exists = await prisma.notificationRecipient.findUnique({ where: { notificationId_userId: { notificationId, userId: scope.actor.id } }, select: { id: true } });
    if (!exists) throw new HttpError("NOTIFICATION_NOT_FOUND", "Notification not found");
  }
}

export async function markAllNotificationsRead(scope: OrgScope): Promise<void> {
  await prisma.notificationRecipient.updateMany({ where: { userId: scope.actor.id, readAt: null }, data: { readAt: new Date() } });
}
