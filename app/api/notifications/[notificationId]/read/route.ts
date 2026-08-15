// POST /api/notifications/[notificationId]/read — mark one of the caller's
// own notifications read. Ownership is the NotificationRecipient row itself
// (userId = actor.id) — a foreign notificationId 404s.
import type { NextRequest } from "next/server";
import { handle, requireAuth } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { markNotificationRead } from "@/lib/server/notifications/service";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ notificationId: string }> }) {
  return handle(async () => {
    const ctx = await requireAuth();
    const scope = await requireOrgScope(ctx);
    const { notificationId } = await params;
    await markNotificationRead(scope, notificationId);
    return ok({ id: notificationId });
  });
}
