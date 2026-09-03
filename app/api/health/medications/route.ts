// GET /api/health/medications — cross-visit medication administration log
// (filters: studentId, staffId, search, page/pageSize). Content is entirely
// hidden unless the caller holds health.viewSensitive — mirrors visit detail
// redaction (medication name/dose is inherently sensitive; there is no
// non-sensitive projection). health.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { listMedicationAdministrations } from "@/lib/server/health/medications";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("health.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "health");
    const sensitive = ctx.permissions.has("health.viewSensitive");
    const sp = request.nextUrl.searchParams;
    const data = await listMedicationAdministrations(scope, sensitive, {
      studentId: singleParam(sp, "studentId"),
      staffId: singleParam(sp, "staffId"),
      search: singleParam(sp, "search"),
      page: singleParam(sp, "page") ? Number(singleParam(sp, "page")) : undefined,
      pageSize: singleParam(sp, "pageSize") ? Number(singleParam(sp, "pageSize")) : undefined,
    });
    return ok(data.data, data.meta);
  });
}
