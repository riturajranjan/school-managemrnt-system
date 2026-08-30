// POST /api/hr/contracts/[contractId]/status { status }
// "archived" is the delete-equivalent — a contract is a historical employment
// record, never hard-deleted. hr.manage.
import type { NextRequest } from "next/server";
import { handle, HttpError, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { CONTRACT_STATUS_VALUES, setContractStatus } from "@/lib/server/hr/contracts";
import type { ContractStatusDto } from "@/lib/api/contracts";

export async function POST(request: NextRequest, { params }: { params: Promise<{ contractId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    const { contractId } = await params;
    const body = (await readJson(request)) as { status?: unknown };
    if (typeof body.status !== "string" || !(CONTRACT_STATUS_VALUES as readonly string[]).includes(body.status)) {
      throw new HttpError("VALIDATION_ERROR", "Invalid status");
    }
    return ok(await setContractStatus(scope, contractId, body.status as ContractStatusDto));
  });
}
