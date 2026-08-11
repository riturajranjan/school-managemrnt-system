// POST /api/super-admin/support/tickets/[ticketId]/assign — assign to a platform
// admin (validated) or unassign (assignedToUserId: null).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { assignTicket } from "@/lib/server/platform/support-service";

type Ctx = { params: Promise<{ ticketId: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const ctx = await requirePermission("platform.support.manage");
    const { ticketId } = await params;
    const body = await readJson(request);
    return ok(await assignTicket({ id: ctx.user.id, name: ctx.user.name ?? null }, ticketId, body));
  });
}
