// GET  /api/fees/structures?status= — fee structures for the active session. fees.view.
// POST /api/fees/structures — create a fee structure (DRAFT). fees.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createFeeStructure, listFeeStructures } from "@/lib/server/fees/structures";
import type { FeeStructureStatusDto } from "@/lib/api/contracts";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("fees.view");
    const scope = await requireOrgScope(ctx);
    const status = singleParam(request.nextUrl.searchParams, "status") as FeeStructureStatusDto | undefined;
    const data = await listFeeStructures(scope, { status });
    return ok(data);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("fees.manage");
    const scope = await requireOrgScope(ctx);
    const data = await createFeeStructure(scope, await readJson(request));
    return ok(data);
  });
}
