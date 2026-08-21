// GET   /api/library/copies/[copyId] — library.view.
// PATCH /api/library/copies/[copyId] — library.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getCopy, updateCopy } from "@/lib/server/library/copies";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ copyId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("library.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "library");
    const { copyId } = await params;
    return ok(await getCopy(scope, copyId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ copyId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("library.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "library");
    const { copyId } = await params;
    return ok(await updateCopy(scope, copyId, await readJson(request)));
  });
}
