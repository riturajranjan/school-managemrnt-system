// GET /api/academics/subjects/[subjectId]/classes — classes this subject is
// assigned to in the active academic session. academics.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listSubjectClasses } from "@/lib/server/academics/class-subjects-service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ subjectId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("academics.view");
    const scope = await requireOrgScope(ctx);
    const { subjectId } = await params;
    return ok(await listSubjectClasses(scope, subjectId));
  });
}
