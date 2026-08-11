// POST /api/super-admin/trials/[subscriptionId]/extend — extend a trial's window.
// Body: { days }. platform.trials.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { extendTrial } from "@/lib/server/platform/trials-service";

type Ctx = { params: Promise<{ subscriptionId: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const ctx = await requirePermission("platform.trials.manage");
    const { subscriptionId } = await params;
    const body = await readJson(request);
    return ok(await extendTrial({ id: ctx.user.id, name: ctx.user.name ?? null }, subscriptionId, body));
  });
}
