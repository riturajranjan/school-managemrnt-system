// POST /api/communication/conversations/[conversationId]/read — mark the
// caller's own read position forward (monotonic — never regresses). communication.send.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { markConversationRead } from "@/lib/server/communication/service";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("communication.send");
    const scope = await requireOrgScope(ctx);
    const { conversationId } = await params;
    await markConversationRead(scope, conversationId);
    return ok({ success: true });
  });
}
