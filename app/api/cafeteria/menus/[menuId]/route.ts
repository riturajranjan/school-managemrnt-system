// GET /api/cafeteria/menus/[menuId] — full detail with items. cafeteria.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getMenuDetail } from "@/lib/server/cafeteria/menus";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ menuId: string }> }) {
  return handle(async () => {
    const { menuId } = await params;
    const ctx = await requirePermission("cafeteria.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "cafeteria");
    return ok(await getMenuDetail(scope, menuId));
  });
}
