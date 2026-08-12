// GET /api/attendance/session?sectionId=...&date=YYYY-MM-DD — READ-ONLY: the
// roster (from ENROLLED enrollment) + existing session/records + summary. Does
// not create DB state. attendance.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { singleParam } from "@/lib/server/api/request";
import { fail, ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getSessionView } from "@/lib/server/attendance/service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("attendance.view");
    const scope = await requireOrgScope(ctx);
    const sectionId = singleParam(request.nextUrl.searchParams, "sectionId");
    const date = singleParam(request.nextUrl.searchParams, "date");
    if (!sectionId || !date) return fail("VALIDATION_ERROR", "sectionId and date are required");
    return ok(await getSessionView(scope, sectionId, date));
  });
}
