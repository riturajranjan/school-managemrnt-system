// DELETE /api/academics/classes/[classId]/subjects/[assignmentId] — remove one
// class→subject assignment. academics.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { removeClassSubject } from "@/lib/server/academics/class-subjects-service";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ classId: string; assignmentId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("academics.manage");
    const scope = await requireOrgScope(ctx);
    const { classId, assignmentId } = await params;
    return ok(await removeClassSubject(scope, classId, assignmentId));
  });
}
