// GET /api/transport/reports — real route utilization, maintenance/fuel cost
// totals and document compliance. No fabricated on-time%/cost-per-km. transport.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getTransportReports } from "@/lib/server/transport/reports";

export async function GET(_request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("transport.view");
    const scope = await requireOrgScope(ctx);
    return ok(await getTransportReports(scope));
  });
}
