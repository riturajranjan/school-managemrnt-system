// GET /api/academics/enrollable-students — ACTIVE students in the active school +
// session not yet enrolled in any section (for the enrollment picker). academics.view.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listEnrollableStudents } from "@/lib/server/academics/service";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("academics.view");
    const scope = await requireOrgScope(ctx);
    return ok(await listEnrollableStudents(scope));
  });
}
