// POST /api/super-admin/addons/[id]/status — change catalog lifecycle status.
// platform.addons.manage. Body: { status: "draft" | "active" | "archived" }.
import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { parseInput } from "@/lib/server/validation";
import { setAddOnStatus } from "@/lib/server/platform/addons-service";

const schema = z.object({ status: z.enum(["draft", "active", "archived"]) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("platform.addons.manage");
    const { id } = await params;
    const { status } = parseInput(schema, await readJson(request));
    return ok(await setAddOnStatus({ id: ctx.user.id, name: ctx.user.name ?? null }, id, status));
  });
}
