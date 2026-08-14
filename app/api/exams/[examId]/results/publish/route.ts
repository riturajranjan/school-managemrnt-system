// POST /api/exams/[examId]/results/publish — atomically publish this exam's
// results (fails closed on incomplete/unverified marks or missing grading
// scheme). One publication per exam — a second attempt is 409
// RESULT_ALREADY_PUBLISHED. results.publish.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { publishExamResults } from "@/lib/server/results/service";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ examId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("results.publish");
    const scope = await requireOrgScope(ctx);
    const { examId } = await params;
    return ok(await publishExamResults(scope, examId));
  });
}
