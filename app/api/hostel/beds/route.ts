// GET /api/hostel/beds — hostel.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { listBeds } from "@/lib/server/hostel/rooms";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("hostel.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "hostel");
    const sp = request.nextUrl.searchParams;
    return ok(await listBeds(scope, { roomId: singleParam(sp, "roomId"), hostelId: singleParam(sp, "hostelId"), status: singleParam(sp, "status"), search: singleParam(sp, "search") }));
  });
}
