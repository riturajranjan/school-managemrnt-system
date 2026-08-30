// GET  /api/hr/contracts — hr.view or hr.manage (whole-directory read).
// POST /api/hr/contracts — hr.manage.
import type { NextRequest } from "next/server";
import { handle, requireAnyPermission, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createContract, listContracts } from "@/lib/server/hr/contracts";
import type { ContractStatusDto } from "@/lib/api/contracts";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requireAnyPermission(["hr.view", "hr.manage"]);
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    return ok(
      await listContracts(scope, {
        staffId: singleParam(sp, "staffId"),
        status: singleParam(sp, "status") as ContractStatusDto | undefined,
      }),
    );
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await createContract(scope, await readJson(request)));
  });
}
