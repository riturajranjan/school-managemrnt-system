// POST /api/super-admin/payments/[paymentId]/reverse — administrative reversal.
// Marks the payment REVERSED and re-opens the invoice (PAID → OPEN). No payment
// history is deleted. platform.payments.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { reversePayment } from "@/lib/server/platform/payments-service";

type Ctx = { params: Promise<{ paymentId: string }> };

export async function POST(_request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const ctx = await requirePermission("platform.payments.manage");
    const { paymentId } = await params;
    return ok(await reversePayment({ id: ctx.user.id, name: ctx.user.name ?? null }, paymentId));
  });
}
