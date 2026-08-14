// GET  /api/exams/[examId]/schedule — the exam's subject schedule. exams.view.
// POST /api/exams/[examId]/schedule — add a scheduled paper (validated + conflict-
//      checked). exams.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createScheduleEntry, listSchedule } from "@/lib/server/exams/schedule-service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ examId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("exams.view");
    const scope = await requireOrgScope(ctx);
    const { examId } = await params;
    return ok(await listSchedule(scope, examId));
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ examId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("exams.manage");
    const scope = await requireOrgScope(ctx);
    const { examId } = await params;
    return ok(await createScheduleEntry(scope, examId, await readJson(request)));
  });
}
