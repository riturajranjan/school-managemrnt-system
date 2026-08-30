// POST /api/hr/policies/[policyId]/status { status }
// "archived" is the delete-equivalent — a policy is never hard-deleted. hr.manage.
import type { NextRequest } from "next/server";
import { handle, HttpError, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { HR_POLICY_STATUS_VALUES, setHrPolicyStatus } from "@/lib/server/hr/policies";
import type { HrPolicyStatusDto } from "@/lib/api/contracts";

export async function POST(request: NextRequest, { params }: { params: Promise<{ policyId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    const { policyId } = await params;
    const body = (await readJson(request)) as { status?: unknown };
    if (typeof body.status !== "string" || !(HR_POLICY_STATUS_VALUES as readonly string[]).includes(body.status)) {
      throw new HttpError("VALIDATION_ERROR", "Invalid status");
    }
    return ok(await setHrPolicyStatus(scope, policyId, body.status as HrPolicyStatusDto));
  });
}
