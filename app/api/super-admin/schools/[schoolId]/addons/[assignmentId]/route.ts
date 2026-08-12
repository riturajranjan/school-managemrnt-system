// DELETE /api/super-admin/schools/[schoolId]/addons/[assignmentId] — end an
// add-on assignment (status ENDED). platform.addons.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { removeSchoolAddOn } from "@/lib/server/platform/addons-service";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ schoolId: string; assignmentId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("platform.addons.manage");
    const { schoolId, assignmentId } = await params;
    return ok(await removeSchoolAddOn({ id: ctx.user.id, name: ctx.user.name ?? null }, schoolId, assignmentId));
  });
}
