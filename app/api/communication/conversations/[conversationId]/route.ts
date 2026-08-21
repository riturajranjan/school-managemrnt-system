// GET /api/communication/conversations/[conversationId] — one conversation,
// participant-only (404 for non-participants — no existence leak). communication.send.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getConversation } from "@/lib/server/communication/service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("communication.send");
    const scope = await requireOrgScope(ctx);
    const { conversationId } = await params;
    return ok(await getConversation(scope, conversationId));
  });
}
