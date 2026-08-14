// GET /api/exams/marks-summary?examId= — lightweight per-paper marks-entry
// status across (optionally one) exam, for the Marks hub and verification queue.
// marks.enter or marks.verify.
import type { NextRequest } from "next/server";
import { handle, requireAnyPermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listMarksSummary } from "@/lib/server/exams/marks-service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requireAnyPermission(["marks.enter", "marks.verify"]);
    const scope = await requireOrgScope(ctx);
    const examId = request.nextUrl.searchParams.get("examId") ?? undefined;
    return ok(await listMarksSummary(scope, { examId }));
  });
}
