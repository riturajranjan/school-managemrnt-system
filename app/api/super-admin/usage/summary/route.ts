// GET /api/super-admin/usage/summary — real usage warning aggregates (dashboard
// limit warnings). Read-only; platform.usage.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { getUsageSummary } from "@/lib/server/platform/usage-service";

export async function GET(_request: NextRequest) {
  return handle(async () => {
    await requirePermission("platform.usage.view");
    return ok(await getUsageSummary());
  });
}
