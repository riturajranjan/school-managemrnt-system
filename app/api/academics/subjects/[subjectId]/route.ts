// GET   /api/academics/subjects/[subjectId] — one subject. academics.view.
// PATCH /api/academics/subjects/[subjectId] — update it. academics.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getSubject, updateSubject } from "@/lib/server/academics/subjects-service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ subjectId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("academics.view");
    const scope = await requireOrgScope(ctx);
    const { subjectId } = await params;
    return ok(await getSubject(scope, subjectId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ subjectId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("academics.manage");
    const scope = await requireOrgScope(ctx);
    const { subjectId } = await params;
    return ok(await updateSubject(scope, subjectId, await readJson(request)));
  });
}
