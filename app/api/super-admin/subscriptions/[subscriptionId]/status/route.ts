// POST /api/super-admin/subscriptions/[subscriptionId]/status — lifecycle
// transition (activate / past-due / cancel immediate / end). platform.subscriptions.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { setSubscriptionStatus } from "@/lib/server/platform/subscriptions-service";

type Ctx = { params: Promise<{ subscriptionId: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    await requirePermission("platform.subscriptions.manage");
    const { subscriptionId } = await params;
    const body = await readJson(request);
    return ok(await setSubscriptionStatus(subscriptionId, body));
  });
}
