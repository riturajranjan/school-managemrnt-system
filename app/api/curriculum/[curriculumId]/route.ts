// GET /api/curriculum/[curriculumId] — full Unit->Chapter->Topic content tree
// (no section progress). PATCH — title/description. DELETE — DRAFT only.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { deleteCurriculum, getCurriculum, updateCurriculum } from "@/lib/server/curriculum/service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ curriculumId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("curriculum.view");
    const scope = await requireOrgScope(ctx);
    const { curriculumId } = await params;
    return ok(await getCurriculum(scope, curriculumId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ curriculumId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("curriculum.manage");
    const scope = await requireOrgScope(ctx);
    const { curriculumId } = await params;
    return ok(await updateCurriculum(scope, curriculumId, await readJson(request)));
  });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ curriculumId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("curriculum.manage");
    const scope = await requireOrgScope(ctx);
    const { curriculumId } = await params;
    return ok(await deleteCurriculum(scope, curriculumId));
  });
}
