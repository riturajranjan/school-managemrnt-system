// GET /api/transport/fees — a thin read view over the real Phase 9F Fees
// engine, scoped to the "Transport" FeeCategory. transport.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getTransportFeesSummary } from "@/lib/server/transport/fees";

export async function GET(_request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("transport.view");
    const scope = await requireOrgScope(ctx);
    return ok(await getTransportFeesSummary(scope));
  });
}
