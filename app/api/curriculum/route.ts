// GET  /api/curriculum — list curricula (filters: classId, subjectId, status,
//      search, page/pageSize). POST — create a curriculum for a real
//      (Class, Subject) offered via ClassSubject. curriculum.view / manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { parsePagination, readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createCurriculum, listCurriculum } from "@/lib/server/curriculum/service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("curriculum.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const { page, pageSize } = parsePagination(sp);
    const { data, meta } = await listCurriculum(scope, {
      classId: singleParam(sp, "classId"),
      subjectId: singleParam(sp, "subjectId"),
      status: singleParam(sp, "status"),
      search: singleParam(sp, "search"),
      page, pageSize,
    });
    return ok(data, meta);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("curriculum.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await createCurriculum(scope, await readJson(request)));
  });
}
