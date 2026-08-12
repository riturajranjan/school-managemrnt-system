// GET  /api/super-admin/addons — add-on catalog (with assigned-school counts).
// POST /api/super-admin/addons — create a catalog add-on.
// platform.addons.view / platform.addons.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { createAddOn, listAddOns } from "@/lib/server/platform/addons-service";

export async function GET() {
  return handle(async () => {
    await requirePermission("platform.addons.view");
    return ok(await listAddOns());
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("platform.addons.manage");
    return ok(await createAddOn({ id: ctx.user.id, name: ctx.user.name ?? null }, await readJson(request)));
  });
}
