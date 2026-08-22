// GET  /api/inventory/locations — inventory.view.
// POST /api/inventory/locations — inventory.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { createLocation, listLocations } from "@/lib/server/inventory/locations";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("inventory.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "inventory");
    return ok(await listLocations(scope));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("inventory.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "inventory");
    return ok(await createLocation(scope, await readJson(request)));
  });
}
