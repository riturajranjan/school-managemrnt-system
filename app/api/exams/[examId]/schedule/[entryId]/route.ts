// PATCH  /api/exams/[examId]/schedule/[entryId] — edit a scheduled paper (re-
//        validated + conflict-checked). DELETE — remove it. exams.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { deleteScheduleEntry, updateScheduleEntry } from "@/lib/server/exams/schedule-service";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ examId: string; entryId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("exams.manage");
    const scope = await requireOrgScope(ctx);
    const { examId, entryId } = await params;
    return ok(await updateScheduleEntry(scope, examId, entryId, await readJson(request)));
  });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ examId: string; entryId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("exams.manage");
    const scope = await requireOrgScope(ctx);
    const { examId, entryId } = await params;
    return ok(await deleteScheduleEntry(scope, examId, entryId));
  });
}
