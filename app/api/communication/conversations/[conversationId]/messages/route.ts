// GET  /api/communication/conversations/[conversationId]/messages?cursor=&limit=
//      — cursor-paginated history, newest page first. communication.send.
// POST /api/communication/conversations/[conversationId]/messages { body }
//      — send a real message; senderUserId always server-derived. communication.send.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listMessages, sendMessage } from "@/lib/server/communication/service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("communication.send");
    const scope = await requireOrgScope(ctx);
    const { conversationId } = await params;
    const sp = request.nextUrl.searchParams;
    const limitRaw = singleParam(sp, "limit");
    return ok(await listMessages(scope, conversationId, { cursor: singleParam(sp, "cursor"), limit: limitRaw ? Number(limitRaw) : undefined }));
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("communication.send");
    const scope = await requireOrgScope(ctx);
    const { conversationId } = await params;
    return ok(await sendMessage(scope, conversationId, await readJson(request)));
  });
}
