// GET  /api/exams — exams for the active academic session (search/status/termId).
// POST /api/exams — create an exam. exams.view / exams.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createExam, listExams } from "@/lib/server/exams/service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("exams.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    return ok(await listExams(scope, { status: singleParam(sp, "status"), termId: singleParam(sp, "termId"), search: singleParam(sp, "search") }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("exams.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await createExam(scope, await readJson(request)));
  });
}
