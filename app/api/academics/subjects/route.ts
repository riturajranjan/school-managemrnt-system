// GET  /api/academics/subjects — school-wide subject catalogue (search/status/
//      sort/page params). POST — create a subject. academics.view / academics.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createSubject, listSubjects } from "@/lib/server/academics/subjects-service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("academics.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const pageRaw = singleParam(sp, "page");
    const pageSizeRaw = singleParam(sp, "pageSize");
    return ok(await listSubjects(scope, {
      search: singleParam(sp, "search"),
      status: singleParam(sp, "status"),
      sort: singleParam(sp, "sort"),
      page: pageRaw ? Number(pageRaw) : undefined,
      pageSize: pageSizeRaw ? Number(pageSizeRaw) : undefined,
    }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("academics.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await createSubject(scope, await readJson(request)));
  });
}
