// GET  /api/super-admin/schools — platform school directory (paginated/filtered).
// POST /api/super-admin/schools — provision a new school (transactional).
// Platform scope: gated by platform.schools.* permissions; no tenant scope.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { parsePagination, readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { listSchools, provisionSchool } from "@/lib/server/platform/schools-service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    await requirePermission("platform.schools.view");
    const sp = request.nextUrl.searchParams;
    const { page, pageSize } = parsePagination(sp);
    const sortRaw = singleParam(sp, "sort");
    const { data, meta } = await listSchools({
      page,
      pageSize,
      search: singleParam(sp, "search"),
      status: singleParam(sp, "status"),
      sort: sortRaw === "createdAt" ? "createdAt" : "name",
      order: singleParam(sp, "order") === "desc" ? "desc" : "asc",
    });
    return ok(data, meta);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("platform.schools.create");
    const body = await readJson(request);
    const result = await provisionSchool({ id: ctx.user.id, name: ctx.user.name ?? null }, body);
    return ok(result);
  });
}
