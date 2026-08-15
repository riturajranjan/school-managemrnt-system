// GET /api/my-day — the authenticated actor's real daily view: their own
// Staff profile, today's real timetable + attendance action state, real
// pending marks tasks, real upcoming exams. Homework/Lesson Plans stay
// explicitly unavailable (no real backend yet). dashboard.view — this is a
// personal read scoped to the caller's own real Staff.userId, never another
// teacher's data.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getMyDay } from "@/lib/server/my-day/service";

export async function GET(_request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("dashboard.view");
    const scope = await requireOrgScope(ctx);
    return ok(await getMyDay(scope));
  });
}
