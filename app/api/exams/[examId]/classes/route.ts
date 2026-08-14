// PUT /api/exams/[examId]/classes { classIds: [...] } — atomically reconcile which
// real Classes this exam applies to (sections inherit through their class).
// exams.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { reconcileExamClasses } from "@/lib/server/exams/service";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ examId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("exams.manage");
    const scope = await requireOrgScope(ctx);
    const { examId } = await params;
    return ok(await reconcileExamClasses(scope, examId, await readJson(request)));
  });
}
