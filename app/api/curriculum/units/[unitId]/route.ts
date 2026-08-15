// PATCH /api/curriculum/units/[unitId] — edit title/description/order/dates/
// estimatedPeriods. DELETE — only while the parent curriculum is DRAFT.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { deleteUnit, updateUnit } from "@/lib/server/curriculum/service";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ unitId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("curriculum.manage");
    const scope = await requireOrgScope(ctx);
    const { unitId } = await params;
    return ok(await updateUnit(scope, unitId, await readJson(request)));
  });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ unitId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("curriculum.manage");
    const scope = await requireOrgScope(ctx);
    const { unitId } = await params;
    return ok(await deleteUnit(scope, unitId));
  });
}
