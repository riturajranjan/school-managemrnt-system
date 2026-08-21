// GET /api/transport/staff-on-duty?role=driver|attendant — real Staff
// currently on active duty somewhere (derived from ACTIVE
// TransportRouteAssignment rows). transport.view.
import type { NextRequest } from "next/server";
import { handle, HttpError, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listCurrentTransportStaff } from "@/lib/server/transport/routes";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("transport.view");
    const scope = await requireOrgScope(ctx);
    const role = request.nextUrl.searchParams.get("role");
    if (role !== "driver" && role !== "attendant") throw new HttpError("VALIDATION_ERROR", 'role must be "driver" or "attendant"');
    return ok(await listCurrentTransportStaff(scope, role));
  });
}
