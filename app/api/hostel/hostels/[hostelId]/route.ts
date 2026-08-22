// GET   /api/hostel/hostels/[hostelId] — hostel.view.
// PATCH /api/hostel/hostels/[hostelId] — hostel.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getHostel, updateHostel } from "@/lib/server/hostel/hostels";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ hostelId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hostel.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "hostel");
    const { hostelId } = await params;
    return ok(await getHostel(scope, hostelId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ hostelId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hostel.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "hostel");
    const { hostelId } = await params;
    return ok(await updateHostel(scope, hostelId, await readJson(request)));
  });
}
