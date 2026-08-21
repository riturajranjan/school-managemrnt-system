// GET /api/transport/dashboard — real, DB-derived counts only. transport.view.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getTransportDashboard } from "@/lib/server/transport/dashboard";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("transport.view");
    const scope = await requireOrgScope(ctx);
    return ok(await getTransportDashboard(scope));
  });
}
