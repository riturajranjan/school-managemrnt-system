// GET  /api/academics/sections[?classId=][&academicSessionId=] — sections in
// the active school+session (or another real session of the same school, e.g.
// Phase 8E Promotion listing a promotion target's sections).
// POST /api/academics/sections — create a section. academics.view / academics.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createSection, listSections } from "@/lib/server/academics/service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("academics.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    return ok(await listSections(scope, singleParam(sp, "classId"), singleParam(sp, "academicSessionId")));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("academics.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await createSection(scope, await readJson(request)));
  });
}
