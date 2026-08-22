// GET  /api/activities/events/[eventId]/participants — activities.view.
// POST /api/activities/events/[eventId]/participants — register a real,
//      active Student for a PUBLISHED event. activities.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { listParticipants, registerParticipant } from "@/lib/server/activities/participants";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  return handle(async () => {
    const { eventId } = await params;
    const ctx = await requirePermission("activities.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "activities");
    return ok(await listParticipants(scope, eventId));
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  return handle(async () => {
    const { eventId } = await params;
    const ctx = await requirePermission("activities.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "activities");
    return ok(await registerParticipant(scope, eventId, await readJson(request)));
  });
}
