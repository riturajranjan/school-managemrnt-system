// POST /api/super-admin/plans/[planId]/status — change plan lifecycle
// (draft/active/archived). Archive instead of hard-delete. platform.plans.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { setPlanStatus } from "@/lib/server/platform/plans-service";

type Ctx = { params: Promise<{ planId: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    await requirePermission("platform.plans.manage");
    const { planId } = await params;
    const body = await readJson(request);
    return ok(await setPlanStatus(planId, body));
  });
}
