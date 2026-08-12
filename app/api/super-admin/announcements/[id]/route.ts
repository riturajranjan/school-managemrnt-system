// GET   /api/super-admin/announcements/[id] — a single announcement.
// PATCH /api/super-admin/announcements/[id] — edit fields.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { getAnnouncement, updateAnnouncement } from "@/lib/server/platform/announcements-service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requirePermission("platform.announcements.view");
    const { id } = await params;
    return ok(await getAnnouncement(id));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("platform.announcements.manage");
    const { id } = await params;
    return ok(await updateAnnouncement({ id: ctx.user.id, name: ctx.user.name ?? null }, id, await readJson(request)));
  });
}
