// GET  /api/academics/sections/[sectionId]/teaching-assignments — teachers for a
//      section. POST { subjectId, staffId } — assign a teacher to a subject in the
//      section. academics.view / academics.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createTeachingAssignment, listTeachingAssignments } from "@/lib/server/academics/teaching-assignments-service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ sectionId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("academics.view");
    const scope = await requireOrgScope(ctx);
    const { sectionId } = await params;
    return ok(await listTeachingAssignments(scope, sectionId));
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ sectionId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("academics.manage");
    const scope = await requireOrgScope(ctx);
    const { sectionId } = await params;
    return ok(await createTeachingAssignment(scope, sectionId, await readJson(request)));
  });
}
