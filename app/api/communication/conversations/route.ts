// GET /api/communication/conversations — the caller's own real conversations
// (they must be a participant). communication.send.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listConversations } from "@/lib/server/communication/service";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("communication.send");
    const scope = await requireOrgScope(ctx);
    return ok(await listConversations(scope));
  });
}
