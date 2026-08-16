// GET  /api/fees/categories — active fee categories for the school. fees.view.
// POST /api/fees/categories — create a fee category. fees.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createFeeCategory, listFeeCategories } from "@/lib/server/fees/categories";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("fees.view");
    const scope = await requireOrgScope(ctx);
    const data = await listFeeCategories(scope, singleParam(request.nextUrl.searchParams, "includeArchived") === "true");
    return ok(data);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("fees.manage");
    const scope = await requireOrgScope(ctx);
    const data = await createFeeCategory(scope, await readJson(request));
    return ok(data);
  });
}
