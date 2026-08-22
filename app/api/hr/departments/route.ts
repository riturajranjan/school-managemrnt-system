// GET  /api/hr/departments — hr.view.
// POST /api/hr/departments — hr.manage.
// Not feature-gated: matches /api/staff's own precedent — core staff
// attribute master data is not a premium HR add-on.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createDepartment, listDepartments } from "@/lib/server/hr/departments";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("hr.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    return ok(await listDepartments(scope, { status: singleParam(sp, "status"), search: singleParam(sp, "search") }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await createDepartment(scope, await readJson(request)));
  });
}
