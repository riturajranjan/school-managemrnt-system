// GET /api/action-inbox/summary — real counts (total/byPriority/byCategory)
// for the sidebar/dashboard badge. Never a hardcoded number. dashboard.view.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getActionInboxSummary } from "@/lib/server/action-inbox/service";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("dashboard.view");
    const scope = await requireOrgScope(ctx);
    return ok(await getActionInboxSummary(scope, { communication: ctx.permissions.has("communication.send") }));
  });
}
