// GET /api/academics/classes/[classId]/subjects — subjects assigned to a class.
// POST { subjectId } — assign one active subject. PUT { subjectIds } — atomically
// reconcile the full set. academics.view / academics.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { assignSubject, listClassSubjects, reconcileClassSubjects } from "@/lib/server/academics/class-subjects-service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ classId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("academics.view");
    const scope = await requireOrgScope(ctx);
    const { classId } = await params;
    return ok(await listClassSubjects(scope, classId));
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ classId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("academics.manage");
    const scope = await requireOrgScope(ctx);
    const { classId } = await params;
    return ok(await assignSubject(scope, classId, await readJson(request)));
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ classId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("academics.manage");
    const scope = await requireOrgScope(ctx);
    const { classId } = await params;
    return ok(await reconcileClassSubjects(scope, classId, await readJson(request)));
  });
}
