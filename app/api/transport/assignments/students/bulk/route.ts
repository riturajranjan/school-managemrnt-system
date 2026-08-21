// POST /api/transport/assignments/students/bulk { classId, routeId,
// pickupStopId } — resolves eligible students server-side from real
// Enrollment; a browser-provided list is never trusted. transport.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { bulkAssignStudentTransport } from "@/lib/server/transport/student-assignments";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("transport.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await bulkAssignStudentTransport(scope, await readJson(request)));
  });
}
