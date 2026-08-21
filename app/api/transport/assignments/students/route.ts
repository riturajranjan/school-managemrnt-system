// GET  /api/transport/assignments/students — transport.view.
// POST /api/transport/assignments/students — assign one student. transport.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { assignStudentTransport, listStudentAssignments } from "@/lib/server/transport/student-assignments";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("transport.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    return ok(await listStudentAssignments(scope, { status: singleParam(sp, "status"), routeId: singleParam(sp, "routeId") }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("transport.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await assignStudentTransport(scope, await readJson(request)));
  });
}
