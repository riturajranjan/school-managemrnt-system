// PATCH /api/transport/incidents/[incidentId]/status — transition an
// incident's status (investigate/resolve/close). transport.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { updateIncidentStatus } from "@/lib/server/transport/incidents";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ incidentId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("transport.manage");
    const scope = await requireOrgScope(ctx);
    const { incidentId } = await params;
    const body = await readJson(request);
    return ok(await updateIncidentStatus(scope, incidentId, body));
  });
}
