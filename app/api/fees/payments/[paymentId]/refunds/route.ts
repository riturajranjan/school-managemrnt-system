// GET  /api/fees/payments/[paymentId]/refunds — refunds against a payment. fees.view.
// POST /api/fees/payments/[paymentId]/refunds — create a refund. fees.refund.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createFeeRefund, listFeeRefunds } from "@/lib/server/fees/refunds";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ paymentId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("fees.view");
    const scope = await requireOrgScope(ctx);
    const { paymentId } = await params;
    const data = await listFeeRefunds(scope, paymentId);
    return ok(data);
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ paymentId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("fees.refund");
    const scope = await requireOrgScope(ctx);
    const { paymentId } = await params;
    const data = await createFeeRefund(scope, paymentId, await readJson(request));
    return ok(data);
  });
}
