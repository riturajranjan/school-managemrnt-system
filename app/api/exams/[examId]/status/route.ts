// POST /api/exams/[examId]/status { status: "draft"|"scheduled"|"completed"|"archived" }. exams.manage.
import type { NextRequest } from "next/server";
import { handle, HttpError, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { setExamStatus } from "@/lib/server/exams/service";

const VALID = ["draft", "scheduled", "completed", "archived"] as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ examId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("exams.manage");
    const scope = await requireOrgScope(ctx);
    const { examId } = await params;
    const body = (await readJson(request)) as { status?: unknown };
    if (typeof body.status !== "string" || !VALID.includes(body.status as (typeof VALID)[number])) {
      throw new HttpError("VALIDATION_ERROR", `status must be one of: ${VALID.join(", ")}`);
    }
    return ok(await setExamStatus(scope, examId, body.status as (typeof VALID)[number]));
  });
}
