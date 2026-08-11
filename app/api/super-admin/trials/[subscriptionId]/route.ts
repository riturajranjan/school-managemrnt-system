// GET /api/super-admin/trials/[subscriptionId] — trial detail. platform.trials.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { getTrial } from "@/lib/server/platform/trials-service";

type Ctx = { params: Promise<{ subscriptionId: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    await requirePermission("platform.trials.view");
    const { subscriptionId } = await params;
    return ok(await getTrial(subscriptionId));
  });
}
