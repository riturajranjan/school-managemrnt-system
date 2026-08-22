// GET   /api/hostel/rooms/[roomId] — hostel.view.
// PATCH /api/hostel/rooms/[roomId] — hostel.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getRoom, updateRoom } from "@/lib/server/hostel/rooms";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hostel.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "hostel");
    const { roomId } = await params;
    return ok(await getRoom(scope, roomId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hostel.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "hostel");
    const { roomId } = await params;
    return ok(await updateRoom(scope, roomId, await readJson(request)));
  });
}
