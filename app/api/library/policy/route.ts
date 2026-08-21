// GET   /api/library/policy — real, admin-editable loan/fine policy. library.view.
// PATCH /api/library/policy — library.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getLibraryPolicy, updateLibraryPolicy } from "@/lib/server/library/policy";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("library.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "library");
    return ok(await getLibraryPolicy(scope));
  });
}

export async function PATCH(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("library.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "library");
    return ok(await updateLibraryPolicy(scope, await readJson(request)));
  });
}
