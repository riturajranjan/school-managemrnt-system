// POST /api/calendar/[calendarEventId]/cancel — soft-cancel a manual
// CalendarEvent (status ACTIVE -> CANCELLED). calendar.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { cancelCalendarEvent } from "@/lib/server/calendar/service";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ calendarEventId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("calendar.manage");
    const scope = await requireOrgScope(ctx);
    const { calendarEventId } = await params;
    await cancelCalendarEvent(scope, calendarEventId);
    return ok({ id: calendarEventId });
  });
}
