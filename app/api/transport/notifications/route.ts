// GET  /api/transport/notifications — real transport-tagged notifications
// sent through the Phase 9D engine. transport.view.
// POST /api/transport/notifications — send a real notification to selected
// staff (drivers/attendants/managers with a linked User account only).
// transport.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listTransportNotifications, sendTransportNotification } from "@/lib/server/transport/notifications";

export async function GET(_request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("transport.view");
    const scope = await requireOrgScope(ctx);
    const notifications = await listTransportNotifications(scope);
    return ok({ notifications });
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("transport.manage");
    const scope = await requireOrgScope(ctx);
    const body = await readJson(request);
    return ok(await sendTransportNotification(scope, body));
  });
}
