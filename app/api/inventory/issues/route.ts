// GET  /api/inventory/issues — inventory.view.
// POST /api/inventory/issues — issue stock to a real Staff/Student, or an
//      OTHER descriptive label (department/classroom/event). inventory.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { issueStock, listIssues } from "@/lib/server/inventory/issues";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("inventory.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "inventory");
    const sp = request.nextUrl.searchParams;
    return ok(await listIssues(scope, { status: singleParam(sp, "status"), outstandingOnly: singleParam(sp, "outstandingOnly") === "true" }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("inventory.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "inventory");
    return ok(await issueStock(scope, await readJson(request)));
  });
}
