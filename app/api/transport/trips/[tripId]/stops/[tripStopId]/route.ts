// POST /api/transport/trips/[tripId]/stops/[tripStopId] { status: "arrived"
// | "departed" } — server-timestamped. transport.manage OR the trip's own
// assigned driver/attendant.
import type { NextRequest } from "next/server";
import { handle, HttpError, requireAuth } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { markTripStopStatus } from "@/lib/server/transport/trips";

export async function POST(request: NextRequest, { params }: { params: Promise<{ tripId: string; tripStopId: string }> }) {
  return handle(async () => {
    const ctx = await requireAuth();
    const scope = await requireOrgScope(ctx);
    const { tripId, tripStopId } = await params;
    const body = (await readJson(request)) as { status?: unknown };
    if (body.status !== "arrived" && body.status !== "departed") throw new HttpError("VALIDATION_ERROR", 'status must be "arrived" or "departed"');
    return ok(await markTripStopStatus(scope, tripId, tripStopId, body.status, ctx.permissions.has("transport.manage")));
  });
}
