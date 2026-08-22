// GET  /api/hostel/hostels — hostel.view.
// POST /api/hostel/hostels — hostel.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { createHostel, listHostels } from "@/lib/server/hostel/hostels";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("hostel.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "hostel");
    const sp = request.nextUrl.searchParams;
    return ok(await listHostels(scope, { status: singleParam(sp, "status") }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("hostel.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "hostel");
    return ok(await createHostel(scope, await readJson(request)));
  });
}
