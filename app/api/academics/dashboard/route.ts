// GET /api/academics/dashboard — Academics hub aggregation: real classes,
// teaching staff, attendance (canonical Phase 5B DTO), curriculum insights,
// homework/lesson-plan status counts, upcoming calendar events. academics.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getAcademicsDashboard } from "@/lib/server/academics/dashboard-service";

export async function GET(_request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("academics.view");
    const scope = await requireOrgScope(ctx);
    return ok(await getAcademicsDashboard(scope));
  });
}
