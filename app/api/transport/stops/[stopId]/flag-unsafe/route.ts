// POST /api/transport/stops/[stopId]/flag-unsafe { safetyNotes } — transport.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { flagStopUnsafe } from "@/lib/server/transport/stops";

export async function POST(request: NextRequest, { params }: { params: Promise<{ stopId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("transport.manage");
    const scope = await requireOrgScope(ctx);
    const { stopId } = await params;
    return ok(await flagStopUnsafe(scope, stopId, await readJson(request)));
  });
}
