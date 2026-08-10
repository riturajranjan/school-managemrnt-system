// POST /api/students/[studentId]/guardians — link an existing guardian, or
// create + link a new one, with per-link flags (relation, primary, pickup, …).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { requireOrgScope } from "@/lib/server/api/scope";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { linkGuardianToStudent } from "@/lib/server/guardians/service";

type Ctx = { params: Promise<{ studentId: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const ctx = await requirePermission("guardians.update");
    const scope = await requireOrgScope(ctx);
    const { studentId } = await params;
    const body = await readJson(request);
    return ok(await linkGuardianToStudent(scope, studentId, body));
  });
}
