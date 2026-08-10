// GET /api/super-admin/onboarding — schools in onboarding, with real progress
// and the live SETUP_PENDING count. platform.onboarding.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { parsePagination, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { listOnboarding } from "@/lib/server/platform/onboarding-service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    await requirePermission("platform.onboarding.view");
    const sp = request.nextUrl.searchParams;
    const { page, pageSize } = parsePagination(sp);
    const { data, meta } = await listOnboarding({
      page,
      pageSize,
      search: singleParam(sp, "search"),
      status: singleParam(sp, "status"),
    });
    return ok(data, meta);
  });
}
