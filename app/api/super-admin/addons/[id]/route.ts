// GET   /api/super-admin/addons/[id] — a single catalog add-on.
// PATCH /api/super-admin/addons/[id] — update catalog fields.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { getAddOn, updateAddOn } from "@/lib/server/platform/addons-service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requirePermission("platform.addons.view");
    const { id } = await params;
    return ok(await getAddOn(id));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("platform.addons.manage");
    const { id } = await params;
    return ok(await updateAddOn({ id: ctx.user.id, name: ctx.user.name ?? null }, id, await readJson(request)));
  });
}
