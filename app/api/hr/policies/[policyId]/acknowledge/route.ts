// POST /api/hr/policies/[policyId]/acknowledge — self-service. hr.viewOwn
// (or hr.view/hr.manage, which imply it). Takes NO staffId — the caller's
// own Staff record is resolved server-side from the session, exactly like
// every other self-service endpoint. An employee can only ever acknowledge
// for themselves.
import type { NextRequest } from "next/server";
import { handle, HttpError, requireAnyPermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { acknowledgePolicy } from "@/lib/server/hr/policies";
import { getCurrentStaffProfile } from "@/lib/server/staff/service";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ policyId: string }> }) {
  return handle(async () => {
    const ctx = await requireAnyPermission(["hr.viewOwn", "hr.view", "hr.manage"]);
    const scope = await requireOrgScope(ctx);
    const { policyId } = await params;
    const me = await getCurrentStaffProfile(scope);
    if (!me) throw new HttpError("NOT_FOUND", "No staff profile is linked to your account");
    await acknowledgePolicy(scope, policyId, me.id);
    return ok({ acknowledged: true });
  });
}
