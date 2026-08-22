// GET  /api/counseling/cases — list case METADATA (no confidential notes).
//      Filters: studentId, status, assignedCounselorStaffId, unassigned.
//      counseling.view.
// POST /api/counseling/cases — open a new case via referral for a real,
//      active Student. Either counseling.manage (admin/counselor opening a
//      case directly) or counseling.refer (a Teacher submitting a referral —
//      grants no further read access to this or any other case).
import type { NextRequest } from "next/server";
import { handle, requireAnyPermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { createReferral, listCases } from "@/lib/server/counseling/cases";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requireAnyPermission(["counseling.view"]);
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "counseling");
    const sp = request.nextUrl.searchParams;
    return ok(await listCases(scope, {
      studentId: singleParam(sp, "studentId"), status: singleParam(sp, "status"),
      assignedCounselorStaffId: singleParam(sp, "assignedCounselorStaffId"), unassigned: sp.get("unassigned") === "true",
    }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requireAnyPermission(["counseling.manage", "counseling.refer"]);
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "counseling");
    return ok(await createReferral(scope, await readJson(request)));
  });
}
