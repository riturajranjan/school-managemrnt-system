// GET   /api/transport/vehicles/[vehicleId] — transport.view.
// PATCH /api/transport/vehicles/[vehicleId] — transport.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getVehicle, updateVehicle } from "@/lib/server/transport/vehicles";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ vehicleId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("transport.view");
    const scope = await requireOrgScope(ctx);
    const { vehicleId } = await params;
    return ok(await getVehicle(scope, vehicleId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ vehicleId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("transport.manage");
    const scope = await requireOrgScope(ctx);
    const { vehicleId } = await params;
    return ok(await updateVehicle(scope, vehicleId, await readJson(request)));
  });
}
