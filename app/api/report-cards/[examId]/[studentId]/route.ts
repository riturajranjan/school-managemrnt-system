// GET /api/report-cards/[examId]/[studentId] — the official report card DTO
// for one student: a presentation of the published, immutable StudentExamResult
// snapshot. Never a live/unpublished preview. results.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getReportCard } from "@/lib/server/report-cards/service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ examId: string; studentId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("results.view");
    const scope = await requireOrgScope(ctx);
    const { examId, studentId } = await params;
    return ok(await getReportCard(scope, examId, studentId));
  });
}
