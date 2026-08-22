// GET /api/cafeteria/meals/[mealRecordId] — cafeteria.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getMeal } from "@/lib/server/cafeteria/meals";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ mealRecordId: string }> }) {
  return handle(async () => {
    const { mealRecordId } = await params;
    const ctx = await requirePermission("cafeteria.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "cafeteria");
    return ok(await getMeal(scope, mealRecordId));
  });
}
