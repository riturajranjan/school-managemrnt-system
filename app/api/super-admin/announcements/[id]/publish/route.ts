// POST /api/super-admin/announcements/[id]/publish — publish (in-app only; no
// email/SMS/push delivery). platform.announcements.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { publishAnnouncement } from "@/lib/server/platform/announcements-service";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("platform.announcements.manage");
    const { id } = await params;
    return ok(await publishAnnouncement({ id: ctx.user.id, name: ctx.user.name ?? null }, id));
  });
}
