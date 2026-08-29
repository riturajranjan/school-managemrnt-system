// GET  /api/library/digital-resources?search= — real digital resource
// records (external links only). library.view.
// POST /api/library/digital-resources — add one. library.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { createDigitalResource, listDigitalResources } from "@/lib/server/library/digital-resources";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("library.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "library");
    return ok(await listDigitalResources(scope, { search: singleParam(request.nextUrl.searchParams, "search") }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("library.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "library");
    return ok(await createDigitalResource(scope, await readJson(request)));
  });
}
