// GET   /api/super-admin/support/tickets/[ticketId] — ticket detail (messages,
//        internal notes, real SA-4F health).
// PATCH /api/super-admin/support/tickets/[ticketId] — edit subject/priority/category.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { getTicket, updateTicket } from "@/lib/server/platform/support-service";

type Ctx = { params: Promise<{ ticketId: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    await requirePermission("platform.support.view");
    const { ticketId } = await params;
    return ok(await getTicket(ticketId));
  });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    await requirePermission("platform.support.manage");
    const { ticketId } = await params;
    const body = await readJson(request);
    return ok(await updateTicket(ticketId, body));
  });
}
