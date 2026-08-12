// POST /api/attendance/sessions — get-or-create the DRAFT attendance session for
// { sectionId, date } (race-safe via the unique constraint). attendance.mark.
import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { parseInput } from "@/lib/server/validation";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createOrGetSession } from "@/lib/server/attendance/service";

const schema = z.object({ sectionId: z.string().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("attendance.mark");
    const scope = await requireOrgScope(ctx);
    const { sectionId, date } = parseInput(schema, await readJson(request));
    return ok(await createOrGetSession(scope, sectionId, date, { id: ctx.user.id, name: ctx.user.name ?? null }));
  });
}
