// POST /api/super-admin/status/incidents — record a manual incident.
// platform.status.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { createIncident } from "@/lib/server/platform/status-service";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("platform.status.manage");
    return ok(await createIncident({ id: ctx.user.id, name: ctx.user.name ?? null }, await readJson(request)));
  });
}
