// GET/PATCH /api/cafeteria/locations/[locationId]. GET: cafeteria.view.
// PATCH: cafeteria.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getLocation, updateLocation } from "@/lib/server/cafeteria/locations";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ locationId: string }> }) {
  return handle(async () => {
    const { locationId } = await params;
    const ctx = await requirePermission("cafeteria.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "cafeteria");
    return ok(await getLocation(scope, locationId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ locationId: string }> }) {
  return handle(async () => {
    const { locationId } = await params;
    const ctx = await requirePermission("cafeteria.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "cafeteria");
    return ok(await updateLocation(scope, locationId, await readJson(request)));
  });
}
