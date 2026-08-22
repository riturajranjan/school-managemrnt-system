// GET   /api/hr/designations/[designationId] — hr.view.
// PATCH /api/hr/designations/[designationId] — hr.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getDesignation, updateDesignation } from "@/lib/server/hr/designations";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ designationId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.view");
    const scope = await requireOrgScope(ctx);
    const { designationId } = await params;
    return ok(await getDesignation(scope, designationId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ designationId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    const { designationId } = await params;
    return ok(await updateDesignation(scope, designationId, await readJson(request)));
  });
}
