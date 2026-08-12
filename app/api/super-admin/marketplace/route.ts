// GET  /api/super-admin/marketplace[?category=] — app catalog (installed counts).
// POST /api/super-admin/marketplace — create a catalog app.
// platform.marketplace.view / platform.marketplace.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { createApp, listApps } from "@/lib/server/platform/marketplace-service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    await requirePermission("platform.marketplace.view");
    const category = singleParam(request.nextUrl.searchParams, "category");
    return ok(await listApps(category ?? undefined));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("platform.marketplace.manage");
    return ok(await createApp({ id: ctx.user.id, name: ctx.user.name ?? null }, await readJson(request)));
  });
}
