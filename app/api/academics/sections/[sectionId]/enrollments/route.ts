// GET  /api/academics/sections/[sectionId]/enrollments — the section roster.
// POST /api/academics/sections/[sectionId]/enrollments — enroll students { studentIds }.
// academics.view / academics.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { enrollStudents, listRoster } from "@/lib/server/academics/service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ sectionId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("academics.view");
    const scope = await requireOrgScope(ctx);
    const { sectionId } = await params;
    return ok(await listRoster(scope, sectionId));
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ sectionId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("academics.manage");
    const scope = await requireOrgScope(ctx);
    const { sectionId } = await params;
    return ok(await enrollStudents(scope, sectionId, await readJson(request)));
  });
}
