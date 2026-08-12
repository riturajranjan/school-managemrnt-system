// POST /api/attendance/sessions/[sessionId]/lock — lock the register (no further
// edits via marking APIs). attendance.mark.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { lockSession } from "@/lib/server/attendance/service";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("attendance.mark");
    const scope = await requireOrgScope(ctx);
    const { sessionId } = await params;
    return ok(await lockSession(scope, sessionId));
  });
}
