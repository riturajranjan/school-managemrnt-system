// GET  /api/transport/fuel — real fuel log + insights in one response. transport.view.
// POST /api/transport/fuel — log a fill-up. Decimal-safe. transport.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getFuelInsights, listFuelLogs, logFuelEntry } from "@/lib/server/transport/fuel";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("transport.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const [records, insights] = await Promise.all([listFuelLogs(scope, { vehicleId: singleParam(sp, "vehicleId") }), getFuelInsights(scope)]);
    return ok({ records, insights });
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("transport.manage");
    const scope = await requireOrgScope(ctx);
    const body = await readJson(request);
    return ok(await logFuelEntry(scope, body));
  });
}
