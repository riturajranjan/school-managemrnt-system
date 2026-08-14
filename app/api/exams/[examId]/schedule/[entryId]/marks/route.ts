// GET /api/exams/[examId]/schedule/[entryId]/marks — the paper's roster + marks
//     + sheet lifecycle state. marks.enter or marks.verify.
// PUT /api/exams/[examId]/schedule/[entryId]/marks — transactional bulk save (no
//     partial success). marks.enter.
import type { NextRequest } from "next/server";
import { handle, requireAnyPermission, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getMarksRoster, saveMarks } from "@/lib/server/exams/marks-service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ examId: string; entryId: string }> }) {
  return handle(async () => {
    const ctx = await requireAnyPermission(["marks.enter", "marks.verify"]);
    const scope = await requireOrgScope(ctx);
    const { examId, entryId } = await params;
    return ok(await getMarksRoster(scope, examId, entryId));
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ examId: string; entryId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("marks.enter");
    const scope = await requireOrgScope(ctx);
    const { examId, entryId } = await params;
    return ok(await saveMarks(scope, examId, entryId, await readJson(request)));
  });
}
