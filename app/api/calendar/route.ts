// GET  /api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD — merged real CalendarEvent
//      rows + derived Exam/Homework/Lesson-Plan occurrences. calendar.view.
// POST /api/calendar — create a manual CalendarEvent. calendar.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createCalendarEvent, listCalendarEvents } from "@/lib/server/calendar/service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("calendar.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const data = await listCalendarEvents(scope, { from: singleParam(sp, "from"), to: singleParam(sp, "to") });
    return ok(data);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("calendar.manage");
    const scope = await requireOrgScope(ctx);
    const id = await createCalendarEvent(scope, await readJson(request));
    return ok({ id });
  });
}
