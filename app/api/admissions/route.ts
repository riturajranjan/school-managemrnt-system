// GET  /api/admissions — paginated, filtered admission applications (scoped).
// POST /api/admissions — create an application (server assigns branch/session).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { requireOrgScope } from "@/lib/server/api/scope";
import { multiParam, parsePagination, readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { createApplication, listApplications } from "@/lib/server/admissions/service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("admissions.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const { page, pageSize } = parsePagination(sp);
    const { data, meta } = await listApplications(scope, {
      page,
      pageSize,
      search: singleParam(sp, "search"),
      stage: multiParam(sp, "stage"),
      source: multiParam(sp, "source"),
      appliedClass: singleParam(sp, "appliedClass"),
      branchId: singleParam(sp, "branchId"),
      academicSessionId: singleParam(sp, "academicSessionId"),
      assignedOfficerId: singleParam(sp, "assignedOfficerId"),
    });
    return ok(data, meta);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("admissions.create");
    const scope = await requireOrgScope(ctx);
    const body = await readJson(request);
    return ok(await createApplication(scope, body));
  });
}
