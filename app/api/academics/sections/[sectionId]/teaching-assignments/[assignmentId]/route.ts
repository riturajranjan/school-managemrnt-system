// DELETE /api/academics/sections/[sectionId]/teaching-assignments/[assignmentId]
// — remove a teacher assignment. academics.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { removeTeachingAssignment } from "@/lib/server/academics/teaching-assignments-service";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ sectionId: string; assignmentId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("academics.manage");
    const scope = await requireOrgScope(ctx);
    const { sectionId, assignmentId } = await params;
    return ok(await removeTeachingAssignment(scope, sectionId, assignmentId));
  });
}
