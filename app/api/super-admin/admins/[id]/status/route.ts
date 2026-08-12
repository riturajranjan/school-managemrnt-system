// POST /api/super-admin/admins/[id]/status — activate/suspend a platform admin
// (last-super-admin protected). platform.admins.manage.
import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { parseInput } from "@/lib/server/validation";
import { setAdminStatus } from "@/lib/server/platform/platform-admins-service";

const schema = z.object({ status: z.enum(["active", "suspended"]) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("platform.admins.manage");
    const { id } = await params;
    const { status } = parseInput(schema, await readJson(request));
    return ok(await setAdminStatus({ id: ctx.user.id, name: ctx.user.name ?? null }, id, status));
  });
}
