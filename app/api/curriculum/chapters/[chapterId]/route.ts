// PATCH /api/curriculum/chapters/[chapterId] — edit title/order. DELETE — only
// while the parent curriculum is DRAFT.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { deleteChapter, updateChapter } from "@/lib/server/curriculum/service";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ chapterId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("curriculum.manage");
    const scope = await requireOrgScope(ctx);
    const { chapterId } = await params;
    return ok(await updateChapter(scope, chapterId, await readJson(request)));
  });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ chapterId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("curriculum.manage");
    const scope = await requireOrgScope(ctx);
    const { chapterId } = await params;
    return ok(await deleteChapter(scope, chapterId));
  });
}
