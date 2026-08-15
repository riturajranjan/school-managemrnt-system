// PATCH /api/calendar/[calendarEventId] — edit a manual CalendarEvent. calendar.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { updateCalendarEvent } from "@/lib/server/calendar/service";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ calendarEventId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("calendar.manage");
    const scope = await requireOrgScope(ctx);
    const { calendarEventId } = await params;
    await updateCalendarEvent(scope, calendarEventId, await readJson(request));
    return ok({ id: calendarEventId });
  });
}
