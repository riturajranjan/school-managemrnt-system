// GET   /api/transport/routes/[routeId] — transport.view.
// PATCH /api/transport/routes/[routeId] — transport.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getRoute, updateRoute } from "@/lib/server/transport/routes";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ routeId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("transport.view");
    const scope = await requireOrgScope(ctx);
    const { routeId } = await params;
    return ok(await getRoute(scope, routeId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ routeId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("transport.manage");
    const scope = await requireOrgScope(ctx);
    const { routeId } = await params;
    return ok(await updateRoute(scope, routeId, await readJson(request)));
  });
}
