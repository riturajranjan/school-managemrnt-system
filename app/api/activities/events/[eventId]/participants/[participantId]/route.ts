// PATCH /api/activities/events/[eventId]/participants/[participantId] —
// update registration/attendance status. Never academic Attendance.
// activities.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { updateParticipant } from "@/lib/server/activities/participants";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ eventId: string; participantId: string }> }) {
  return handle(async () => {
    const { eventId, participantId } = await params;
    const ctx = await requirePermission("activities.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "activities");
    return ok(await updateParticipant(scope, eventId, participantId, await readJson(request)));
  });
}
