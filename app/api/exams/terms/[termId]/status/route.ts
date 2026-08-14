// POST /api/exams/terms/[termId]/status { status: "active" | "archived" }. exams.manage.
import type { NextRequest } from "next/server";
import { handle, HttpError, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { setTermStatus } from "@/lib/server/exams/service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ termId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("exams.manage");
    const scope = await requireOrgScope(ctx);
    const { termId } = await params;
    const body = (await readJson(request)) as { status?: unknown };
    if (body.status !== "active" && body.status !== "archived") throw new HttpError("VALIDATION_ERROR", 'status must be "active" or "archived"');
    return ok(await setTermStatus(scope, termId, body.status));
  });
}
