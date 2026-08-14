// GET   /api/staff/[staffId] — one staff member. hr.view.
// PATCH /api/staff/[staffId] — update it. hr.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getStaff, updateStaff } from "@/lib/server/staff/service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ staffId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.view");
    const scope = await requireOrgScope(ctx);
    const { staffId } = await params;
    return ok(await getStaff(scope, staffId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ staffId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    const { staffId } = await params;
    return ok(await updateStaff(scope, staffId, await readJson(request)));
  });
}
