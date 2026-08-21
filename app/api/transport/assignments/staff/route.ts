// GET  /api/transport/assignments/staff — transport.view.
// POST /api/transport/assignments/staff — transport.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { assignStaffTransport, listStaffAssignments } from "@/lib/server/transport/staff-assignments";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("transport.view");
    const scope = await requireOrgScope(ctx);
    return ok(await listStaffAssignments(scope, { status: singleParam(request.nextUrl.searchParams, "status") }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("transport.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await assignStaffTransport(scope, await readJson(request)));
  });
}
