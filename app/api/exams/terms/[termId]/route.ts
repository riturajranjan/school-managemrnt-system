// PATCH /api/exams/terms/[termId] — update a term. exams.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { updateTerm } from "@/lib/server/exams/service";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ termId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("exams.manage");
    const scope = await requireOrgScope(ctx);
    const { termId } = await params;
    return ok(await updateTerm(scope, termId, await readJson(request)));
  });
}
