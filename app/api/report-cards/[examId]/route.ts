// GET /api/report-cards/[examId] — the published-result roster for one exam
// (optionally text-searched via ?q=). 404s honestly (RESULT_NOT_PUBLISHED) if
// the exam's results have not been published yet — never a live preview
// rendered as official. results.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getReportCardRoster } from "@/lib/server/report-cards/service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ examId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("results.view");
    const scope = await requireOrgScope(ctx);
    const { examId } = await params;
    const search = request.nextUrl.searchParams.get("q") ?? undefined;
    return ok(await getReportCardRoster(scope, examId, search));
  });
}
