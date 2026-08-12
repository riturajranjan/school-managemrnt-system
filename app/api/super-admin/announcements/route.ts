// GET  /api/super-admin/announcements[?status=] — platform announcements.
// POST /api/super-admin/announcements — create a DRAFT.
// platform.announcements.view / platform.announcements.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { createAnnouncement, listAnnouncements } from "@/lib/server/platform/announcements-service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    await requirePermission("platform.announcements.view");
    return ok(await listAnnouncements(singleParam(request.nextUrl.searchParams, "status") ?? undefined));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("platform.announcements.manage");
    return ok(await createAnnouncement({ id: ctx.user.id, name: ctx.user.name ?? null }, await readJson(request)));
  });
}
