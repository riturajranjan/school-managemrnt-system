// GET  /api/transport/maintenance — real records + insights in one response
// (avoids a second client request just for the stat tiles). transport.view.
// POST /api/transport/maintenance — schedule a new work order. transport.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getMaintenanceInsights, listMaintenanceRecords, scheduleMaintenance } from "@/lib/server/transport/maintenance";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("transport.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const [records, insights] = await Promise.all([
      listMaintenanceRecords(scope, { vehicleId: singleParam(sp, "vehicleId"), status: singleParam(sp, "status") }),
      getMaintenanceInsights(scope),
    ]);
    return ok({ records, insights });
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("transport.manage");
    const scope = await requireOrgScope(ctx);
    const body = await readJson(request);
    return ok(await scheduleMaintenance(scope, body));
  });
}
