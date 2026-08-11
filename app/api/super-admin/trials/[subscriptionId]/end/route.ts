// POST /api/super-admin/trials/[subscriptionId]/end — TRIALING → ENDED
// (explicit termination; history preserved). platform.trials.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { endTrial } from "@/lib/server/platform/trials-service";

type Ctx = { params: Promise<{ subscriptionId: string }> };

export async function POST(_request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const ctx = await requirePermission("platform.trials.manage");
    const { subscriptionId } = await params;
    return ok(await endTrial({ id: ctx.user.id, name: ctx.user.name ?? null }, subscriptionId));
  });
}
