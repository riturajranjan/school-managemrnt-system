// GET /api/academics/sections/[sectionId]/timetable — grid-friendly section
// timetable (bell columns + weekdays + entries). timetable.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getSectionTimetable } from "@/lib/server/timetable/entries-service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ sectionId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("timetable.view");
    const scope = await requireOrgScope(ctx);
    const { sectionId } = await params;
    return ok(await getSectionTimetable(scope, sectionId));
  });
}
