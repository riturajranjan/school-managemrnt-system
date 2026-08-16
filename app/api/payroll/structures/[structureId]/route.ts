// GET   /api/payroll/structures/[structureId] — detail with resolved component lines. payroll.view.
// PATCH /api/payroll/structures/[structureId] — update; component-line edits blocked once assigned. payroll.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getSalaryStructure, updateSalaryStructure } from "@/lib/server/payroll/structures";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ structureId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("payroll.view");
    const scope = await requireOrgScope(ctx);
    const { structureId } = await params;
    return ok(await getSalaryStructure(scope, structureId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ structureId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("payroll.manage");
    const scope = await requireOrgScope(ctx);
    const { structureId } = await params;
    return ok(await updateSalaryStructure(scope, structureId, await readJson(request)));
  });
}
