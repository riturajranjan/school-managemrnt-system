// GET /api/transport/routes/[routeId]/assignment/history — full crew/vehicle
// history for this route. transport.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listRouteAssignmentHistory } from "@/lib/server/transport/routes";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ routeId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("transport.view");
    const scope = await requireOrgScope(ctx);
    const { routeId } = await params;
    return ok(await listRouteAssignmentHistory(scope, routeId));
  });
}
