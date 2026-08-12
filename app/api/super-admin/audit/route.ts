// GET /api/super-admin/audit — paginated, filtered, READ-ONLY view over the real
// AuditEvent table. platform.audit.view. No mutation endpoints (audit is evidence).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { parsePagination, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { listAuditEvents } from "@/lib/server/platform/audit-service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    await requirePermission("platform.audit.view");
    const sp = request.nextUrl.searchParams;
    const { page, pageSize } = parsePagination(sp);
    const { data, meta } = await listAuditEvents({
      page,
      pageSize,
      search: singleParam(sp, "search") ?? undefined,
      action: singleParam(sp, "action") ?? undefined,
      actor: singleParam(sp, "actor") ?? undefined,
      schoolId: singleParam(sp, "schoolId") ?? singleParam(sp, "school") ?? undefined,
      from: singleParam(sp, "from") ?? undefined,
      to: singleParam(sp, "to") ?? undefined,
    });
    return ok(data, meta);
  });
}
