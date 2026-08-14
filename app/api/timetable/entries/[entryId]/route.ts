// PATCH  /api/timetable/entries/[entryId] — move/edit a lesson (re-validated +
//        conflict-checked). DELETE — remove it. timetable.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { deleteEntry, updateEntry } from "@/lib/server/timetable/entries-service";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ entryId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("timetable.manage");
    const scope = await requireOrgScope(ctx);
    const { entryId } = await params;
    return ok(await updateEntry(scope, entryId, await readJson(request)));
  });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ entryId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("timetable.manage");
    const scope = await requireOrgScope(ctx);
    const { entryId } = await params;
    return ok(await deleteEntry(scope, entryId));
  });
}
