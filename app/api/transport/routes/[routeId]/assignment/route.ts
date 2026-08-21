// GET  /api/transport/routes/[routeId]/assignment — current vehicle/driver/
//      attendant, or null. transport.view.
// POST /api/transport/routes/[routeId]/assignment — ends the current active
//      assignment (if any) and starts a new one. transport.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getCurrentRouteAssignment, setRouteAssignment } from "@/lib/server/transport/routes";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ routeId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("transport.view");
    const scope = await requireOrgScope(ctx);
    const { routeId } = await params;
    return ok(await getCurrentRouteAssignment(scope, routeId));
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ routeId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("transport.manage");
    const scope = await requireOrgScope(ctx);
    const { routeId } = await params;
    return ok(await setRouteAssignment(scope, routeId, await readJson(request)));
  });
}
