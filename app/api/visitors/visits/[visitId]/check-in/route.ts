// POST /api/visitors/visits/[visitId]/check-in — EXPECTED -> CHECKED_IN, server-generated pass number, notifies host. visitors.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { checkInVisit } from "@/lib/server/visitors/visits";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ visitId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("visitors.manage");
    const scope = await requireOrgScope(ctx);
    const { visitId } = await params;
    return ok(await checkInVisit(scope, visitId));
  });
}
