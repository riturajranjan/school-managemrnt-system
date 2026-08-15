// GET  /api/homework — real homework, filterable/paginated (sectionId,
// subjectId, staffId, status, dueFrom, dueTo, search, page, pageSize).
// School-wide read, like exams/marks/results — ownership is enforced on
// mutations, not on this list. homework.view.
// POST /api/homework — create a real DRAFT. Authorship is resolved
// server-side (User -> Staff.userId), never trusted from the client.
// homework.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { parsePagination, readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createHomework, listHomework } from "@/lib/server/homework/service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("homework.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const { page, pageSize } = parsePagination(sp);
    const { data, meta } = await listHomework(scope, {
      sectionId: singleParam(sp, "sectionId"),
      subjectId: singleParam(sp, "subjectId"),
      staffId: singleParam(sp, "staffId"),
      status: singleParam(sp, "status"),
      dueFrom: singleParam(sp, "dueFrom"),
      dueTo: singleParam(sp, "dueTo"),
      search: singleParam(sp, "search"),
      page, pageSize,
    });
    return ok(data, meta);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("homework.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await createHomework(scope, await readJson(request)));
  });
}
