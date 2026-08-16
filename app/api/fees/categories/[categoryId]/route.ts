// PATCH /api/fees/categories/[categoryId] — edit/archive a fee category. fees.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { updateFeeCategory } from "@/lib/server/fees/categories";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ categoryId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("fees.manage");
    const scope = await requireOrgScope(ctx);
    const { categoryId } = await params;
    const data = await updateFeeCategory(scope, categoryId, await readJson(request));
    return ok(data);
  });
}
