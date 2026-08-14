// GET /api/staff/teachers — ACTIVE, teaching-eligible, in-scope staff options for
// Academics/Timetable pickers. Gated by academics.view (NOT hr.*) so academics
// managers can populate teacher pickers without HR-manage rights (plan §11).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getTeachingStaff } from "@/lib/server/staff/service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("academics.view");
    const scope = await requireOrgScope(ctx);
    return ok(await getTeachingStaff(scope, { branchId: singleParam(request.nextUrl.searchParams, "branchId") }));
  });
}
