// POST /api/super-admin/marketplace/[id]/status — change catalog lifecycle status.
// platform.marketplace.manage. Body: { status: "draft" | "active" | "archived" }.
import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { parseInput } from "@/lib/server/validation";
import { setAppStatus } from "@/lib/server/platform/marketplace-service";

const schema = z.object({ status: z.enum(["draft", "active", "archived"]) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("platform.marketplace.manage");
    const { id } = await params;
    const { status } = parseInput(schema, await readJson(request));
    return ok(await setAppStatus({ id: ctx.user.id, name: ctx.user.name ?? null }, id, status));
  });
}
