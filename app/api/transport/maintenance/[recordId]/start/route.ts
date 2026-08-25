// POST /api/transport/maintenance/[recordId]/start — begin scheduled work. transport.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { startMaintenance } from "@/lib/server/transport/maintenance";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ recordId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("transport.manage");
    const scope = await requireOrgScope(ctx);
    const { recordId } = await params;
    return ok(await startMaintenance(scope, recordId));
  });
}
