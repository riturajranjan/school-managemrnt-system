// GET  /api/transport/vehicles — real fleet registry. transport.view.
// POST /api/transport/vehicles — create. Registration number unique/
//      concurrency-safe. transport.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createVehicle, listVehicles } from "@/lib/server/transport/vehicles";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("transport.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    return ok(await listVehicles(scope, { status: singleParam(sp, "status"), search: singleParam(sp, "search") }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("transport.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await createVehicle(scope, await readJson(request)));
  });
}
