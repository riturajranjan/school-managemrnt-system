// POST /api/super-admin/schools/[schoolId]/status — suspend / reactivate a school
// (status change only; data is preserved, never hard-deleted). platform.schools.suspend.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { setSchoolStatus } from "@/lib/server/platform/schools-service";

type Ctx = { params: Promise<{ schoolId: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const ctx = await requirePermission("platform.schools.suspend");
    const { schoolId } = await params;
    const body = await readJson(request);
    return ok(await setSchoolStatus({ id: ctx.user.id, name: ctx.user.name ?? null }, schoolId, body));
  });
}
