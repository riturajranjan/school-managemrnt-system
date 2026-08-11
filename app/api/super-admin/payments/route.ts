// GET  /api/super-admin/payments — payment ledger (paginated/filtered).
// POST /api/super-admin/payments — record a payment against an invoice.
// Platform scope (platform.payments.*).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { parsePagination, readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { listPayments, recordPayment, type PaymentListParams } from "@/lib/server/platform/payments-service";

const SORTS = ["receivedAt", "createdAt"] as const;

export async function GET(request: NextRequest) {
  return handle(async () => {
    await requirePermission("platform.payments.view");
    const sp = request.nextUrl.searchParams;
    const { page, pageSize } = parsePagination(sp);
    const sortRaw = singleParam(sp, "sort");
    const sort = (SORTS as readonly string[]).includes(sortRaw ?? "") ? (sortRaw as PaymentListParams["sort"]) : undefined;
    const { data, meta } = await listPayments({
      page,
      pageSize,
      search: singleParam(sp, "search"),
      schoolId: singleParam(sp, "school") ?? singleParam(sp, "schoolId"),
      method: singleParam(sp, "method"),
      status: singleParam(sp, "status"),
      from: singleParam(sp, "from"),
      to: singleParam(sp, "to"),
      sort,
      order: singleParam(sp, "order") === "asc" ? "asc" : "desc",
    });
    return ok(data, meta);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("platform.payments.manage");
    const body = await readJson(request);
    return ok(await recordPayment({ id: ctx.user.id, name: ctx.user.name ?? null }, body));
  });
}
