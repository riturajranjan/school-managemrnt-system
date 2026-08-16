// POST /api/fees/adjustments — apply a discount/scholarship/late fee to a real charge. fees.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { applyFeeAdjustment } from "@/lib/server/fees/adjustments";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("fees.manage");
    const scope = await requireOrgScope(ctx);
    const data = await applyFeeAdjustment(scope, await readJson(request));
    return ok(data);
  });
}
