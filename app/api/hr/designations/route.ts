// GET  /api/hr/designations — hr.view.
// POST /api/hr/designations — hr.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createDesignation, listDesignations } from "@/lib/server/hr/designations";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("hr.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    return ok(await listDesignations(scope, { status: singleParam(sp, "status"), departmentId: singleParam(sp, "departmentId"), search: singleParam(sp, "search") }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await createDesignation(scope, await readJson(request)));
  });
}
