// GET /api/timetable/teacher/[staffId] — a teacher's weekly timetable. timetable.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getTeacherTimetable } from "@/lib/server/timetable/entries-service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ staffId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("timetable.view");
    const scope = await requireOrgScope(ctx);
    const { staffId } = await params;
    return ok(await getTeacherTimetable(scope, staffId));
  });
}
