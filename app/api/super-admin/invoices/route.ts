// GET  /api/super-admin/invoices — invoice directory (paginated/filtered).
// POST /api/super-admin/invoices — generate an invoice from a subscription.
// Platform scope (platform.invoices.*).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { parsePagination, readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { generateInvoice, listInvoices, type InvoiceListParams } from "@/lib/server/platform/invoices-service";

const SORTS = ["createdAt", "dueAt", "invoiceNumber"] as const;

export async function GET(request: NextRequest) {
  return handle(async () => {
    await requirePermission("platform.invoices.view");
    const sp = request.nextUrl.searchParams;
    const { page, pageSize } = parsePagination(sp);
    const sortRaw = singleParam(sp, "sort");
    const sort = (SORTS as readonly string[]).includes(sortRaw ?? "") ? (sortRaw as InvoiceListParams["sort"]) : undefined;
    const { data, meta } = await listInvoices({
      page,
      pageSize,
      search: singleParam(sp, "search"),
      status: singleParam(sp, "status"),
      schoolId: singleParam(sp, "school") ?? singleParam(sp, "schoolId"),
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
    const ctx = await requirePermission("platform.invoices.manage");
    const body = await readJson(request);
    return ok(await generateInvoice({ id: ctx.user.id, name: ctx.user.name ?? null }, body));
  });
}
