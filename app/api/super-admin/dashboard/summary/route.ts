// GET /api/super-admin/dashboard/summary — real school lifecycle counts for the
// platform overview. platform.dashboard.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { getDashboardSummary } from "@/lib/server/platform/dashboard-service";

export async function GET(_request: NextRequest) {
  return handle(async () => {
    await requirePermission("platform.dashboard.view");
    return ok(await getDashboardSummary());
  });
}
