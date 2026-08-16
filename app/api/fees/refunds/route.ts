// GET /api/fees/refunds — every refund issued for the school. fees.view.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listAllFeeRefunds } from "@/lib/server/fees/refunds";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("fees.view");
    const scope = await requireOrgScope(ctx);
    const data = await listAllFeeRefunds(scope);
    return ok(data);
  });
}
