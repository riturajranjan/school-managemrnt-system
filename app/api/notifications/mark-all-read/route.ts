// POST /api/notifications/mark-all-read — mark all of the caller's own unread notifications read.
import { handle, requireAuth } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { markAllNotificationsRead } from "@/lib/server/notifications/service";

export async function POST() {
  return handle(async () => {
    const ctx = await requireAuth();
    const scope = await requireOrgScope(ctx);
    await markAllNotificationsRead(scope);
    return ok({ success: true });
  });
}
