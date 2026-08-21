// GET  /api/transport/trips — transport.view.
// POST /api/transport/trips — create; one per (route, date, type), DB-
//      enforced concurrency-safe. transport.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createTrip, listTrips } from "@/lib/server/transport/trips";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("transport.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    return ok(await listTrips(scope, { status: singleParam(sp, "status"), routeId: singleParam(sp, "routeId"), vehicleId: singleParam(sp, "vehicleId"), date: singleParam(sp, "date") }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("transport.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await createTrip(scope, await readJson(request)));
  });
}
