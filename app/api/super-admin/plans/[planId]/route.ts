// GET   /api/super-admin/plans/[planId] — a plan with its features.
// PATCH /api/super-admin/plans/[planId] — update plan metadata/pricing/features.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { getPlan, updatePlan } from "@/lib/server/platform/plans-service";

type Ctx = { params: Promise<{ planId: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    await requirePermission("platform.plans.view");
    const { planId } = await params;
    return ok(await getPlan(planId));
  });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    await requirePermission("platform.plans.manage");
    const { planId } = await params;
    const body = await readJson(request);
    return ok(await updatePlan(planId, body));
  });
}
