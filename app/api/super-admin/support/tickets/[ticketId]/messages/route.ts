// POST /api/super-admin/support/tickets/[ticketId]/messages — add a reply
// (internal:false) or an internal note (internal:true). Sets firstResponseAt on
// the first non-internal staff message.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { addMessage } from "@/lib/server/platform/support-service";

type Ctx = { params: Promise<{ ticketId: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const ctx = await requirePermission("platform.support.manage");
    const { ticketId } = await params;
    const body = await readJson(request);
    return ok(await addMessage({ id: ctx.user.id, name: ctx.user.name ?? null }, ticketId, body));
  });
}
