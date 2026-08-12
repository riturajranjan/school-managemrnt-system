// GET /api/super-admin/status — truthful platform status (maintenance mode, live
// DB reachability, open incidents, unmonitored services). platform.status.view.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { getStatus } from "@/lib/server/platform/status-service";

export async function GET() {
  return handle(async () => {
    await requirePermission("platform.status.view");
    return ok(await getStatus());
  });
}
