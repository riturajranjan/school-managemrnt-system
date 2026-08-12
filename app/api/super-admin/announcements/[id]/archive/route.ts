// POST /api/super-admin/announcements/[id]/archive — archive an announcement.
// platform.announcements.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { archiveAnnouncement } from "@/lib/server/platform/announcements-service";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("platform.announcements.manage");
    const { id } = await params;
    return ok(await archiveAnnouncement({ id: ctx.user.id, name: ctx.user.name ?? null }, id));
  });
}
