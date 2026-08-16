// PATCH /api/payroll/components/[componentId] — update name/description/status. payroll.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { updateSalaryComponent } from "@/lib/server/payroll/components";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ componentId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("payroll.manage");
    const scope = await requireOrgScope(ctx);
    const { componentId } = await params;
    return ok(await updateSalaryComponent(scope, componentId, await readJson(request)));
  });
}
