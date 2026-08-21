// GET /api/transport/routes/[routeId]/stops — ordered stop list. transport.view.
// PUT /api/transport/routes/[routeId]/stops { stops } — atomic full replace. transport.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listRouteStops, setRouteStops } from "@/lib/server/transport/routes";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ routeId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("transport.view");
    const scope = await requireOrgScope(ctx);
    const { routeId } = await params;
    return ok(await listRouteStops(scope, routeId));
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ routeId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("transport.manage");
    const scope = await requireOrgScope(ctx);
    const { routeId } = await params;
    return ok(await setRouteStops(scope, routeId, await readJson(request)));
  });
}
