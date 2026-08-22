// PUT /api/cafeteria/menus/[menuId]/items — full replace of a menu's item
// list. cafeteria.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { setMenuItems } from "@/lib/server/cafeteria/menus";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ menuId: string }> }) {
  return handle(async () => {
    const { menuId } = await params;
    const ctx = await requirePermission("cafeteria.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "cafeteria");
    return ok(await setMenuItems(scope, menuId, await readJson(request)));
  });
}
