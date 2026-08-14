// POST /api/exams/[examId]/schedule/[entryId]/marks/verify — Submitted → Verified
// (locks the sheet). marks.verify — SCHOOL_ADMIN/PRINCIPAL only (see catalog.ts);
// no separate "verification teacher" role exists, so this deliberately does not
// widen to TEACHER. Reopening a verified sheet is not implemented in this phase.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { verifyMarks } from "@/lib/server/exams/marks-service";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ examId: string; entryId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("marks.verify");
    const scope = await requireOrgScope(ctx);
    const { examId, entryId } = await params;
    return ok(await verifyMarks(scope, examId, entryId));
  });
}
