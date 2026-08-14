// POST /api/staff/[staffId]/user { userId: string | null } — link (or unlink when
// null) a login account to a staff record. hr.manage.
import type { NextRequest } from "next/server";
import { handle, HttpError, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { setStaffUser } from "@/lib/server/staff/service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ staffId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    const { staffId } = await params;
    const body = (await readJson(request)) as { userId?: unknown };
    if (body.userId !== null && typeof body.userId !== "string") {
      throw new HttpError("VALIDATION_ERROR", "userId must be a string or null");
    }
    return ok(await setStaffUser(scope, staffId, body.userId));
  });
}
