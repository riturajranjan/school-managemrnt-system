// POST /api/payroll/structures/[structureId]/status — active/archived. payroll.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { setSalaryStructureStatus } from "@/lib/server/payroll/structures";

export async function POST(request: NextRequest, { params }: { params: Promise<{ structureId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("payroll.manage");
    const scope = await requireOrgScope(ctx);
    const { structureId } = await params;
    return ok(await setSalaryStructureStatus(scope, structureId, await readJson(request)));
  });
}
