// GET /api/exams/[examId]/results — the exam's results: an immutable published
// snapshot if one exists, otherwise a live preview (published: false).
// results.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getExamResults } from "@/lib/server/results/service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ examId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("results.view");
    const scope = await requireOrgScope(ctx);
    const { examId } = await params;
    return ok(await getExamResults(scope, examId));
  });
}
