// POST /api/super-admin/status/incidents/[id]/resolve — mark an incident resolved.
// platform.status.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { resolveIncident } from "@/lib/server/platform/status-service";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("platform.status.manage");
    const { id } = await params;
    return ok(await resolveIncident({ id: ctx.user.id, name: ctx.user.name ?? null }, id));
  });
}
