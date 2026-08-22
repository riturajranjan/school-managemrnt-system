// GET /api/inventory/items/[itemId]/movements — the item's full ledger. inventory.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { listItemMovements } from "@/lib/server/inventory/movements";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("inventory.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "inventory");
    const { itemId } = await params;
    return ok(await listItemMovements(scope, itemId));
  });
}
