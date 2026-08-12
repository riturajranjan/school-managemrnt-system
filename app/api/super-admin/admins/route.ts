// GET  /api/super-admin/admins — platform administrators (search/role/status).
// POST /api/super-admin/admins — invite an admin. platform.admins.view/manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { inviteAdmin, listAdmins } from "@/lib/server/platform/platform-admins-service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    await requirePermission("platform.admins.view");
    const sp = request.nextUrl.searchParams;
    return ok(await listAdmins({ search: singleParam(sp, "search") ?? undefined, role: singleParam(sp, "role") ?? undefined, status: singleParam(sp, "status") ?? undefined }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("platform.admins.manage");
    return ok(await inviteAdmin({ id: ctx.user.id, name: ctx.user.name ?? null }, await readJson(request)));
  });
}
