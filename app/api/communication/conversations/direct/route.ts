// POST /api/communication/conversations/direct { recipientUserId } — real
// concurrency-safe find-or-create of a DIRECT conversation. communication.send.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { startDirectConversation } from "@/lib/server/communication/service";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("communication.send");
    const scope = await requireOrgScope(ctx);
    return ok(await startDirectConversation(scope, await readJson(request)));
  });
}
