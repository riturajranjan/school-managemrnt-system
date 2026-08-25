// POST /api/transport/maintenance/[recordId]/complete — record cost + close out. transport.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { completeMaintenance } from "@/lib/server/transport/maintenance";

export async function POST(request: NextRequest, { params }: { params: Promise<{ recordId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("transport.manage");
    const scope = await requireOrgScope(ctx);
    const { recordId } = await params;
    const body = await readJson(request);
    return ok(await completeMaintenance(scope, recordId, body));
  });
}
