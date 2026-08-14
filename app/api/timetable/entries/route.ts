// POST /api/timetable/entries { sectionId, subjectId, staffId, periodId, weekday }
// — schedule a lesson (validated + conflict-checked). timetable.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createEntry } from "@/lib/server/timetable/entries-service";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("timetable.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await createEntry(scope, await readJson(request)));
  });
}
