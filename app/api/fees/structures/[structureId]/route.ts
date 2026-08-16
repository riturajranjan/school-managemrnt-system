// GET   /api/fees/structures/[structureId] — detail with items. fees.view.
// PATCH /api/fees/structures/[structureId] — edit (DRAFT/no assignments only). fees.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getFeeStructure, updateFeeStructure } from "@/lib/server/fees/structures";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ structureId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("fees.view");
    const scope = await requireOrgScope(ctx);
    const { structureId } = await params;
    const data = await getFeeStructure(scope, structureId);
    return ok(data);
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ structureId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("fees.manage");
    const scope = await requireOrgScope(ctx);
    const { structureId } = await params;
    const data = await updateFeeStructure(scope, structureId, await readJson(request));
    return ok(data);
  });
}
