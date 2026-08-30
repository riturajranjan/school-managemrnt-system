// GET   /api/hr/contracts/[contractId] — hr.view or hr.manage.
// PATCH /api/hr/contracts/[contractId] — hr.manage.
import type { NextRequest } from "next/server";
import { handle, requireAnyPermission, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getContract, updateContract } from "@/lib/server/hr/contracts";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ contractId: string }> }) {
  return handle(async () => {
    const ctx = await requireAnyPermission(["hr.view", "hr.manage"]);
    const scope = await requireOrgScope(ctx);
    const { contractId } = await params;
    return ok(await getContract(scope, contractId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ contractId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    const { contractId } = await params;
    return ok(await updateContract(scope, contractId, await readJson(request)));
  });
}
