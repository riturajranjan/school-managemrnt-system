// PATCH /api/super-admin/status/incidents/[id] — update incident lifecycle/severity.
// platform.status.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { updateIncident } from "@/lib/server/platform/status-service";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("platform.status.manage");
    const { id } = await params;
    return ok(await updateIncident({ id: ctx.user.id, name: ctx.user.name ?? null }, id, await readJson(request)));
  });
}
