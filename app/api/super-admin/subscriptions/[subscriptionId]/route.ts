// GET   /api/super-admin/subscriptions/[subscriptionId] — subscription detail.
// PATCH /api/super-admin/subscriptions/[subscriptionId] — toggle cancel-at-period-end.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { getSubscription, updateSubscription } from "@/lib/server/platform/subscriptions-service";

type Ctx = { params: Promise<{ subscriptionId: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    await requirePermission("platform.subscriptions.view");
    const { subscriptionId } = await params;
    return ok(await getSubscription(subscriptionId));
  });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    await requirePermission("platform.subscriptions.manage");
    const { subscriptionId } = await params;
    const body = await readJson(request);
    return ok(await updateSubscription(subscriptionId, body));
  });
}
