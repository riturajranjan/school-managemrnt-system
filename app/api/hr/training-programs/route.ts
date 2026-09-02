// GET  /api/hr/training-programs — hr.view or hr.manage (whole-directory read).
// POST /api/hr/training-programs — hr.manage.
import type { NextRequest } from "next/server";
import { handle, requireAnyPermission, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createTrainingProgram, listTrainingPrograms } from "@/lib/server/hr/training";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requireAnyPermission(["hr.view", "hr.manage"]);
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const page = singleParam(sp, "page"), pageSize = singleParam(sp, "pageSize");
    const { data, meta } = await listTrainingPrograms(scope, {
      status: singleParam(sp, "status"),
      category: singleParam(sp, "category"),
      search: singleParam(sp, "search"),
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    return ok(data, meta);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await createTrainingProgram(scope, await readJson(request)));
  });
}
