// GET /api/super-admin/health/summary — real Platform Pulse + health aggregates.
// Read-only; platform.tenant_health.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { getHealthSummary } from "@/lib/server/platform/health-service";

export async function GET(_request: NextRequest) {
  return handle(async () => {
    await requirePermission("platform.tenant_health.view");
    return ok(await getHealthSummary());
  });
}
