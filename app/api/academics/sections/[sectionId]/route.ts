// PATCH /api/academics/sections/[sectionId] — update a section. academics.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { updateSection } from "@/lib/server/academics/service";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ sectionId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("academics.manage");
    const scope = await requireOrgScope(ctx);
    const { sectionId } = await params;
    return ok(await updateSection(scope, sectionId, await readJson(request)));
  });
}
