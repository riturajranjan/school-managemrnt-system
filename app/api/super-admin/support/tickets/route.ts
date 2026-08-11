// GET  /api/super-admin/support/tickets — platform support tickets (paginated/filtered).
// POST /api/super-admin/support/tickets — create a ticket. platform.support.*.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { parsePagination, readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { createTicket, listTickets, type TicketListParams } from "@/lib/server/platform/support-service";

const SORTS = ["updatedAt", "openedAt", "priority"] as const;

export async function GET(request: NextRequest) {
  return handle(async () => {
    await requirePermission("platform.support.view");
    const sp = request.nextUrl.searchParams;
    const { page, pageSize } = parsePagination(sp);
    const sortRaw = singleParam(sp, "sort");
    const sort = (SORTS as readonly string[]).includes(sortRaw ?? "") ? (sortRaw as TicketListParams["sort"]) : undefined;
    const { data, meta } = await listTickets({
      page,
      pageSize,
      search: singleParam(sp, "search"),
      status: singleParam(sp, "status"),
      priority: singleParam(sp, "priority"),
      category: singleParam(sp, "category"),
      assignment: singleParam(sp, "assignment"),
      escalated: singleParam(sp, "escalated") === "true",
      schoolId: singleParam(sp, "school") ?? singleParam(sp, "schoolId"),
      tenantId: singleParam(sp, "tenant") ?? singleParam(sp, "tenantId"),
      sort,
      order: singleParam(sp, "order") === "asc" ? "asc" : "desc",
    });
    return ok(data, meta);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("platform.support.manage");
    const body = await readJson(request);
    return ok(await createTicket({ id: ctx.user.id, name: ctx.user.name ?? null }, body));
  });
}
