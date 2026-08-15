// GET /api/notifications/unread-count — the caller's own unread count (bell badge).
import { handle, requireAuth } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getUnreadCount } from "@/lib/server/notifications/service";

export async function GET() {
  return handle(async () => {
    const ctx = await requireAuth();
    const scope = await requireOrgScope(ctx);
    return ok({ count: await getUnreadCount(scope) });
  });
}
