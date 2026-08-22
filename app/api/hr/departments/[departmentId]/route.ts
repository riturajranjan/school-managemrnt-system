// GET   /api/hr/departments/[departmentId] — hr.view.
// PATCH /api/hr/departments/[departmentId] — hr.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getDepartment, updateDepartment } from "@/lib/server/hr/departments";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ departmentId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.view");
    const scope = await requireOrgScope(ctx);
    const { departmentId } = await params;
    return ok(await getDepartment(scope, departmentId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ departmentId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    const { departmentId } = await params;
    return ok(await updateDepartment(scope, departmentId, await readJson(request)));
  });
}
