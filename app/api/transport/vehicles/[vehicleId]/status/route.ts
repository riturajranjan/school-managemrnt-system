// POST /api/transport/vehicles/[vehicleId]/status { status } — transport.manage.
import type { NextRequest } from "next/server";
import { handle, HttpError, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { setVehicleStatus } from "@/lib/server/transport/vehicles";

const VALID = ["active", "inactive", "maintenance", "archived"] as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ vehicleId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("transport.manage");
    const scope = await requireOrgScope(ctx);
    const { vehicleId } = await params;
    const body = (await readJson(request)) as { status?: unknown };
    if (typeof body.status !== "string" || !VALID.includes(body.status as (typeof VALID)[number])) {
      throw new HttpError("VALIDATION_ERROR", "Invalid status");
    }
    return ok(await setVehicleStatus(scope, vehicleId, body.status as (typeof VALID)[number]));
  });
}
