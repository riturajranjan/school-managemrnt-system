// GET /api/visitors/visits/[visitId] — visit detail. visitors.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getVisit } from "@/lib/server/visitors/visits";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ visitId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("visitors.view");
    const scope = await requireOrgScope(ctx);
    const { visitId } = await params;
    return ok(await getVisit(scope, visitId));
  });
}
