// GET /api/promotions/[promotionId] — a single processed promotion record.
// promotion.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getPromotion } from "@/lib/server/promotion/service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ promotionId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("promotion.view");
    const scope = await requireOrgScope(ctx);
    const { promotionId } = await params;
    return ok(await getPromotion(scope, promotionId));
  });
}
