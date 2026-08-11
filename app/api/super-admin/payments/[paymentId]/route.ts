// GET /api/super-admin/payments/[paymentId] — payment detail. platform.payments.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { getPayment } from "@/lib/server/platform/payments-service";

type Ctx = { params: Promise<{ paymentId: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    await requirePermission("platform.payments.view");
    const { paymentId } = await params;
    return ok(await getPayment(paymentId));
  });
}
