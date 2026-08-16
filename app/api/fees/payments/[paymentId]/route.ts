// GET /api/fees/payments/[paymentId] — a payment/receipt. fees.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getFeePayment } from "@/lib/server/fees/payments";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ paymentId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("fees.view");
    const scope = await requireOrgScope(ctx);
    const { paymentId } = await params;
    const data = await getFeePayment(scope, paymentId);
    return ok(data);
  });
}
