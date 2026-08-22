// GET /api/inventory/categories — distinct item categories (+ counts).
// `category` is plain text on InventoryItem — no independent category CRUD
// existed in the pre-migration UI. inventory.view.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { listCategories } from "@/lib/server/inventory/items";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("inventory.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "inventory");
    return ok(await listCategories(scope));
  });
}
