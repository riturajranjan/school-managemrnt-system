// GET  /api/transport/incidents — real TransportIncident records. transport.view.
// POST /api/transport/incidents — report a new incident. transport.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listIncidents, reportIncident } from "@/lib/server/transport/incidents";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("transport.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const incidents = await listIncidents(scope, { status: singleParam(sp, "status"), vehicleId: singleParam(sp, "vehicleId") });
    return ok({ incidents });
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("transport.manage");
    const scope = await requireOrgScope(ctx);
    const body = await readJson(request);
    return ok(await reportIncident(scope, body));
  });
}
