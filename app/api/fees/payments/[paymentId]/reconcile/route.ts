// POST /api/fees/payments/[paymentId]/reconcile — mark a payment reconciled/mismatch. fees.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { reconcilePayment } from "@/lib/server/fees/payments";

export async function POST(request: NextRequest, { params }: { params: Promise<{ paymentId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("fees.manage");
    const scope = await requireOrgScope(ctx);
    const { paymentId } = await params;
    const data = await reconcilePayment(scope, paymentId, await readJson(request));
    return ok(data);
  });
}
