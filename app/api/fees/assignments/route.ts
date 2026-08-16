// POST /api/fees/assignments — bulk-assign a structure to a student/section/class. fees.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { assignFeeStructure } from "@/lib/server/fees/assignments";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("fees.manage");
    const scope = await requireOrgScope(ctx);
    const data = await assignFeeStructure(scope, await readJson(request));
    return ok(data);
  });
}
