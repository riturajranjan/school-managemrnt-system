// POST /api/super-admin/trials/[subscriptionId]/convert — TRIALING → ACTIVE.
// Activates the subscription record only (no payment collected). platform.trials.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { convertTrial } from "@/lib/server/platform/trials-service";

type Ctx = { params: Promise<{ subscriptionId: string }> };

export async function POST(_request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const ctx = await requirePermission("platform.trials.manage");
    const { subscriptionId } = await params;
    return ok(await convertTrial({ id: ctx.user.id, name: ctx.user.name ?? null }, subscriptionId));
  });
}
