// POST /api/promotions/process — finalize one student's PROMOTED/RETAINED
// decision: creates a NEW Enrollment in the target session + an immutable
// StudentPromotion record, atomically. Every field is re-resolved server-side
// from real data — the client's percentage/grade/class are never trusted.
// promotion.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { processPromotion } from "@/lib/server/promotion/service";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("promotion.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await processPromotion(scope, await readJson(request)));
  });
}
