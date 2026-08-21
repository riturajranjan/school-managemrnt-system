// GET /api/transport/trips/mine — the authenticated driver/attendant's own
// trips, resolved via User -> Staff.userId. No transport permission required
// — self-service is identity-based, never a client-supplied staffId.
import { handle, requireAuth } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listMyTrips } from "@/lib/server/transport/trips";

export async function GET() {
  return handle(async () => {
    const ctx = await requireAuth();
    const scope = await requireOrgScope(ctx);
    return ok(await listMyTrips(scope));
  });
}
