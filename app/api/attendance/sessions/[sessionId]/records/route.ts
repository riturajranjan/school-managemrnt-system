// PATCH /api/attendance/sessions/[sessionId]/records — transactional bulk mark.
// Every studentId is re-validated server-side against an ENROLLED enrollment in
// the session's section; enrollment is resolved server-side (never trusted).
// attendance.mark.
import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { parseInput } from "@/lib/server/validation";
import { requireOrgScope } from "@/lib/server/api/scope";
import { saveRecords, VALID_STATUSES } from "@/lib/server/attendance/service";

const schema = z.object({
  records: z.array(z.object({
    studentId: z.string().min(1),
    status: z.enum(VALID_STATUSES as [string, ...string[]]),
    remarks: z.string().trim().max(300).nullable().optional(),
  })).max(1000),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("attendance.mark");
    const scope = await requireOrgScope(ctx);
    const { sessionId } = await params;
    const { records } = parseInput(schema, await readJson(request));
    return ok(await saveRecords(scope, sessionId, records, { id: ctx.user.id, name: ctx.user.name ?? null }));
  });
}
