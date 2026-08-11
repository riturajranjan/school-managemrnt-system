// POST /api/super-admin/subscriptions/[subscriptionId]/change-plan — move a
// current subscription to another active plan (re-snapshots terms; no proration
// or payment collection in SA-4B). platform.subscriptions.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { changePlan } from "@/lib/server/platform/subscriptions-service";

type Ctx = { params: Promise<{ subscriptionId: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    await requirePermission("platform.subscriptions.manage");
    const { subscriptionId } = await params;
    const body = await readJson(request);
    return ok(await changePlan(subscriptionId, body));
  });
}
