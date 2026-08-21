// GET /api/communication/unread-count — total unread messages across all of
// the caller's real conversations. communication.send.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getUnreadCount } from "@/lib/server/communication/service";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("communication.send");
    const scope = await requireOrgScope(ctx);
    return ok({ count: await getUnreadCount(scope) });
  });
}
