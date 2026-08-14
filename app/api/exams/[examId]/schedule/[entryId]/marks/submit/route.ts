// POST /api/exams/[examId]/schedule/[entryId]/marks/submit — Draft → Submitted.
// marks.enter (the same actor who may enter marks may submit their own work;
// a broad manager may also submit on a teacher's behalf).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { submitMarks } from "@/lib/server/exams/marks-service";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ examId: string; entryId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("marks.enter");
    const scope = await requireOrgScope(ctx);
    const { examId, entryId } = await params;
    return ok(await submitMarks(scope, examId, entryId));
  });
}
