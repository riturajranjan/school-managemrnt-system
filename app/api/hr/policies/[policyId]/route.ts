// GET   /api/hr/policies/[policyId] — hr.view or hr.manage.
// PATCH /api/hr/policies/[policyId] — hr.manage.
import type { NextRequest } from "next/server";
import { handle, requireAnyPermission, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getHrPolicy, updateHrPolicy } from "@/lib/server/hr/policies";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ policyId: string }> }) {
  return handle(async () => {
    const ctx = await requireAnyPermission(["hr.view", "hr.manage"]);
    const scope = await requireOrgScope(ctx);
    const { policyId } = await params;
    return ok(await getHrPolicy(scope, policyId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ policyId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    const { policyId } = await params;
    return ok(await updateHrPolicy(scope, policyId, await readJson(request)));
  });
}
