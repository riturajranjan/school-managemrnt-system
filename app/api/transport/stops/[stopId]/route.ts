// GET /api/transport/stops/[stopId] — transport.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getStop } from "@/lib/server/transport/stops";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ stopId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("transport.view");
    const scope = await requireOrgScope(ctx);
    const { stopId } = await params;
    return ok(await getStop(scope, stopId));
  });
}
