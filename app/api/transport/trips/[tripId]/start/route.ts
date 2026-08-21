// POST /api/transport/trips/[tripId]/start — SCHEDULED -> IN_PROGRESS.
// transport.manage OR the trip's own assigned driver/attendant.
import type { NextRequest } from "next/server";
import { handle, requireAuth } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { startTrip } from "@/lib/server/transport/trips";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const ctx = await requireAuth();
    const scope = await requireOrgScope(ctx);
    const { tripId } = await params;
    return ok(await startTrip(scope, tripId, ctx.permissions.has("transport.manage")));
  });
}
