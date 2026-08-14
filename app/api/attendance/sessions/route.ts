// POST /api/attendance/sessions — get-or-create an attendance session (race-safe).
//   DAILY  (default, backward-compatible): { sectionId, date }  or { type:"daily", … }
//   PERIOD: { type:"period", timetableEntryId, date }
// attendance.mark. Period sessions additionally enforce teacher lesson-ownership.
import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { parseInput } from "@/lib/server/validation";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createOrGetSession } from "@/lib/server/attendance/service";
import { createOrGetPeriodSession } from "@/lib/server/attendance/period-service";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const schema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("daily"), sectionId: z.string().min(1), date: dateStr }),
  z.object({ type: z.literal("period"), timetableEntryId: z.string().min(1), date: dateStr }),
]).or(z.object({ sectionId: z.string().min(1), date: dateStr })); // legacy daily contract

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("attendance.mark");
    const scope = await requireOrgScope(ctx);
    const body = parseInput(schema, await readJson(request));
    const actor = { id: ctx.user.id, name: ctx.user.name ?? null };
    if ("type" in body && body.type === "period") {
      return ok(await createOrGetPeriodSession(scope, body.timetableEntryId, body.date, actor));
    }
    return ok(await createOrGetSession(scope, body.sectionId, body.date, actor));
  });
}
