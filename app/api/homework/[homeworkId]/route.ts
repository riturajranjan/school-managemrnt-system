// GET   /api/homework/[homeworkId] — real detail. homework.view.
// PATCH /api/homework/[homeworkId] — title/description/instructions/dueAt
// only — never section/subject/staff (the update schema has no such fields,
// so a structural edit is impossible by construction). homework.manage,
// ownership enforced server-side (own Staff, or SCHOOL_ADMIN/PRINCIPAL).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getHomework, updateHomework } from "@/lib/server/homework/service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ homeworkId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("homework.view");
    const scope = await requireOrgScope(ctx);
    const { homeworkId } = await params;
    return ok(await getHomework(scope, homeworkId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ homeworkId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("homework.manage");
    const scope = await requireOrgScope(ctx);
    const { homeworkId } = await params;
    return ok(await updateHomework(scope, homeworkId, await readJson(request)));
  });
}
