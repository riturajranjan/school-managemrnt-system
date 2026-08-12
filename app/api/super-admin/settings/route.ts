// GET   /api/super-admin/settings — platform settings singleton (safe fields).
// PATCH /api/super-admin/settings — update settings. Never exposes secrets.
// platform.settings.view / platform.settings.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { getSettings, updateSettings } from "@/lib/server/platform/settings-service";

export async function GET() {
  return handle(async () => {
    await requirePermission("platform.settings.view");
    return ok(await getSettings());
  });
}

export async function PATCH(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("platform.settings.manage");
    return ok(await updateSettings({ id: ctx.user.id, name: ctx.user.name ?? null }, await readJson(request)));
  });
}
