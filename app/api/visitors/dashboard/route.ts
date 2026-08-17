// GET /api/visitors/dashboard — real, visit-derived KPIs. visitors.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getVisitorDashboard } from "@/lib/server/visitors/visits";

export async function GET(_request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("visitors.view");
    const scope = await requireOrgScope(ctx);
    return ok(await getVisitorDashboard(scope));
  });
}
