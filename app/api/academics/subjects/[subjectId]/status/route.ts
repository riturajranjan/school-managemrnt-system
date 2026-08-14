// POST /api/academics/subjects/[subjectId]/status { status: "active" | "inactive" }
// — archive/restore a subject. academics.manage.
import type { NextRequest } from "next/server";
import { handle, HttpError, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { setSubjectStatus } from "@/lib/server/academics/subjects-service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ subjectId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("academics.manage");
    const scope = await requireOrgScope(ctx);
    const { subjectId } = await params;
    const body = (await readJson(request)) as { status?: unknown };
    if (body.status !== "active" && body.status !== "inactive") {
      throw new HttpError("VALIDATION_ERROR", 'status must be "active" or "inactive"');
    }
    return ok(await setSubjectStatus(scope, subjectId, body.status));
  });
}
