// GET /api/attendance/sections — real sections (Academics Foundation) available
// for attendance selection in the caller's scope. attendance.view.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listSections } from "@/lib/server/academics/service";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("attendance.view");
    const scope = await requireOrgScope(ctx);
    return ok(await listSections(scope));
  });
}
