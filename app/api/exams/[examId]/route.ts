// GET   /api/exams/[examId] — exam detail + assigned classes. exams.view.
// PATCH /api/exams/[examId] — update it. exams.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getExam, updateExam } from "@/lib/server/exams/service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ examId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("exams.view");
    const scope = await requireOrgScope(ctx);
    const { examId } = await params;
    return ok(await getExam(scope, examId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ examId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("exams.manage");
    const scope = await requireOrgScope(ctx);
    const { examId } = await params;
    return ok(await updateExam(scope, examId, await readJson(request)));
  });
}
