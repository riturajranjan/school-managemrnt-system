// GET /api/users/[userId]/activity — real AuditEvent history for this
// account (its own User-level events plus events on its linked Staff/
// Student/Guardian record). No new audit table.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getAccountActivity } from "@/lib/server/users/account-detail";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("users.manage");
    const scope = await requireOrgScope(ctx);
    const { userId } = await params;
    return ok(await getAccountActivity(ctx, scope, userId));
  });
}
