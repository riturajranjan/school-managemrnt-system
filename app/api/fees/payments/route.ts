// GET  /api/fees/payments — list/filter payments. fees.view.
// POST /api/fees/payments — record a payment (the receipt). fees.collect.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listFeePayments, recordFeePayment } from "@/lib/server/fees/payments";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("fees.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const page = singleParam(sp, "page"), pageSize = singleParam(sp, "pageSize");
    const { data, meta } = await listFeePayments(scope, {
      studentId: singleParam(sp, "studentId"), method: singleParam(sp, "method"), reconciliationStatus: singleParam(sp, "reconciliationStatus"),
      from: singleParam(sp, "from"), to: singleParam(sp, "to"), page: page ? Number(page) : undefined, pageSize: pageSize ? Number(pageSize) : undefined,
    });
    return ok(data, meta);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("fees.collect");
    const scope = await requireOrgScope(ctx);
    const data = await recordFeePayment(scope, await readJson(request));
    return ok(data);
  });
}
