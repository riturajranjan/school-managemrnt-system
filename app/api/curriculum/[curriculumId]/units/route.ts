// POST /api/curriculum/[curriculumId]/units — add a unit to a curriculum.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createUnit } from "@/lib/server/curriculum/service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ curriculumId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("curriculum.manage");
    const scope = await requireOrgScope(ctx);
    const { curriculumId } = await params;
    return ok(await createUnit(scope, curriculumId, await readJson(request)));
  });
}
