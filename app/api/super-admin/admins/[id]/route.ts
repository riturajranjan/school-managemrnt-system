// GET   /api/super-admin/admins/[id] — a single platform admin.
// PATCH /api/super-admin/admins/[id] — update role (last-super-admin protected).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { getAdmin, updateAdmin } from "@/lib/server/platform/platform-admins-service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requirePermission("platform.admins.view");
    const { id } = await params;
    return ok(await getAdmin(id));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("platform.admins.manage");
    const { id } = await params;
    return ok(await updateAdmin({ id: ctx.user.id, name: ctx.user.name ?? null }, id, await readJson(request)));
  });
}
