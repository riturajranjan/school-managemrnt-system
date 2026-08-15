// GET /api/notifications — the caller's own real notifications (paginated,
// optional unreadOnly filter). Any authenticated user — these are personal,
// per-recipient rows (NotificationRecipient), no separate permission needed.
import type { NextRequest } from "next/server";
import { handle, requireAuth } from "@/lib/server/api/guard";
import { parsePagination } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listMyNotifications } from "@/lib/server/notifications/service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requireAuth();
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const { page, pageSize } = parsePagination(sp);
    const { data, meta } = await listMyNotifications(scope, { unreadOnly: sp.get("unreadOnly") === "true", page, pageSize });
    return ok(data, meta);
  });
}
