// POST /api/academics/sections/[sectionId]/curriculum/units/[unitId]/complete
// — preserves the existing UI's unit-level "Mark complete" button: marks every
// topic under the unit COMPLETED for this section, in one transaction.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { completeUnitForSection } from "@/lib/server/curriculum/service";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ sectionId: string; unitId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("curriculum.manage");
    const scope = await requireOrgScope(ctx);
    const { sectionId, unitId } = await params;
    return ok(await completeUnitForSection(scope, sectionId, unitId));
  });
}
