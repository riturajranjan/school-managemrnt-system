// POST /api/fees/structures/[structureId]/status — DRAFT/ACTIVE/ARCHIVED transition. fees.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { setFeeStructureStatus } from "@/lib/server/fees/structures";

export async function POST(request: NextRequest, { params }: { params: Promise<{ structureId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("fees.manage");
    const scope = await requireOrgScope(ctx);
    const { structureId } = await params;
    const data = await setFeeStructureStatus(scope, structureId, await readJson(request));
    return ok(data);
  });
}
