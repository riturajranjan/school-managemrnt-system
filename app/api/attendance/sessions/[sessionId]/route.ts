// GET /api/attendance/sessions/[sessionId] — session detail (roster + records +
// summary). attendance.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getSessionDetail } from "@/lib/server/attendance/service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("attendance.view");
    const scope = await requireOrgScope(ctx);
    const { sessionId } = await params;
    return ok(await getSessionDetail(scope, sessionId));
  });
}
