// GET /api/results/dashboard — Results hub aggregation: one row per exam past
// draft, composing the real Phase 8B marks summary + Phase 8C results engine.
// results.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getResultsDashboard } from "@/lib/server/results/dashboard-service";

export async function GET(_request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("results.view");
    const scope = await requireOrgScope(ctx);
    return ok(await getResultsDashboard(scope));
  });
}
