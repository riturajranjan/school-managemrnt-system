// GET /api/report-cards — every published exam in scope (most recent first).
// Powers the Report Cards hub. results.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listPublishedExams } from "@/lib/server/report-cards/service";

export async function GET(_request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("results.view");
    const scope = await requireOrgScope(ctx);
    return ok(await listPublishedExams(scope));
  });
}
