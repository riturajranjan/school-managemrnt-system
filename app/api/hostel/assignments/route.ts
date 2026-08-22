// GET  /api/hostel/assignments — hostel.view.
// POST /api/hostel/assignments — allocate a real, active Student to a real,
//      available bed. Concurrency-safe (dual guard: pre-check + partial
//      unique indexes). hostel.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { assignStudent, listAssignments } from "@/lib/server/hostel/assignments";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("hostel.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "hostel");
    const sp = request.nextUrl.searchParams;
    return ok(await listAssignments(scope, {
      hostelId: singleParam(sp, "hostelId"), roomId: singleParam(sp, "roomId"),
      studentId: singleParam(sp, "studentId"), status: singleParam(sp, "status"),
    }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("hostel.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "hostel");
    return ok(await assignStudent(scope, await readJson(request)));
  });
}
