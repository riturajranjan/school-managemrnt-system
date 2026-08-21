// GET /api/transport/trips/[tripId] — full detail incl. stop timeline +
// student roster. transport.view sees any trip in scope; a plain
// authenticated driver/attendant may read only their OWN assigned trip
// (identity-based, via Staff.userId) — anyone else gets a 404, never a
// partial/leaked read.
import type { NextRequest } from "next/server";
import { handle, requireAuth } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getTrip } from "@/lib/server/transport/trips";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const ctx = await requireAuth();
    const scope = await requireOrgScope(ctx);
    const { tripId } = await params;
    return ok(await getTrip(scope, tripId, ctx.permissions.has("transport.view")));
  });
}
