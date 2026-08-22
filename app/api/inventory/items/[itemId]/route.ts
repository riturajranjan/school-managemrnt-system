// GET   /api/inventory/items/[itemId] — inventory.view.
// PATCH /api/inventory/items/[itemId] — inventory.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getItem, updateItem } from "@/lib/server/inventory/items";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("inventory.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "inventory");
    const { itemId } = await params;
    return ok(await getItem(scope, itemId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("inventory.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "inventory");
    const { itemId } = await params;
    return ok(await updateItem(scope, itemId, await readJson(request)));
  });
}
