// GET   /api/super-admin/marketplace/[id] — a single catalog app.
// PATCH /api/super-admin/marketplace/[id] — update catalog fields.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { getApp, updateApp } from "@/lib/server/platform/marketplace-service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requirePermission("platform.marketplace.view");
    const { id } = await params;
    return ok(await getApp(id));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("platform.marketplace.manage");
    const { id } = await params;
    return ok(await updateApp({ id: ctx.user.id, name: ctx.user.name ?? null }, id, await readJson(request)));
  });
}
