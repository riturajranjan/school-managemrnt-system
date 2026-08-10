// GET /api/admissions/stats — global admission aggregates (pipeline + insights),
// scoped to the active tenant/school.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { requireOrgScope } from "@/lib/server/api/scope";
import { ok } from "@/lib/server/api/response";
import { getAdmissionStats } from "@/lib/server/admissions/service";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("admissions.view");
    const scope = await requireOrgScope(ctx);
    return ok(await getAdmissionStats(scope));
  });
}
