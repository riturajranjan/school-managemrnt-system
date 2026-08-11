// GET /api/super-admin/support/summary — real support aggregates (dashboard
// escalations). platform.support.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { getSupportSummary } from "@/lib/server/platform/support-service";

export async function GET(_request: NextRequest) {
  return handle(async () => {
    await requirePermission("platform.support.view");
    return ok(await getSupportSummary());
  });
}
