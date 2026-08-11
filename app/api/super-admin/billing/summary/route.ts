// GET /api/super-admin/billing/summary — real DB-derived billing metrics
// (MRR/ARR from ACTIVE subscriptions, invoice outstanding/overdue). platform.billing.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { getBillingSummary } from "@/lib/server/platform/billing-service";

export async function GET(_request: NextRequest) {
  return handle(async () => {
    await requirePermission("platform.billing.view");
    return ok(await getBillingSummary());
  });
}
