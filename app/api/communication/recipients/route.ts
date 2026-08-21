// GET /api/communication/recipients?search= — real, eligible User recipients
// in the caller's school/tenant (Staff-linked or a privileged non-Staff role).
// communication.send.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listEligibleRecipients } from "@/lib/server/communication/service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("communication.send");
    const scope = await requireOrgScope(ctx);
    return ok(await listEligibleRecipients(scope, singleParam(request.nextUrl.searchParams, "search")));
  });
}
