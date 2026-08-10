// GET   /api/super-admin/schools/[schoolId] — platform-safe school detail.
// PATCH /api/super-admin/schools/[schoolId] — update allowed school metadata.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { getSchoolDetail, updateSchool } from "@/lib/server/platform/schools-service";

type Ctx = { params: Promise<{ schoolId: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    await requirePermission("platform.schools.view");
    const { schoolId } = await params;
    return ok(await getSchoolDetail(schoolId));
  });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const ctx = await requirePermission("platform.schools.update");
    const { schoolId } = await params;
    const body = await readJson(request);
    return ok(await updateSchool({ id: ctx.user.id, name: ctx.user.name ?? null }, schoolId, body));
  });
}
