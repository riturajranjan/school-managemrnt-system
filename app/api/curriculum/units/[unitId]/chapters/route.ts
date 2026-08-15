// POST /api/curriculum/units/[unitId]/chapters — add a chapter to a unit.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createChapter } from "@/lib/server/curriculum/service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ unitId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("curriculum.manage");
    const scope = await requireOrgScope(ctx);
    const { unitId } = await params;
    return ok(await createChapter(scope, unitId, await readJson(request)));
  });
}
