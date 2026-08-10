// GET   /api/guardians/[guardianId] — a guardian with their linked children.
// PATCH /api/guardians/[guardianId] — update guardian contact/details.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { requireOrgScope } from "@/lib/server/api/scope";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { getGuardian, updateGuardian } from "@/lib/server/guardians/service";

type Ctx = { params: Promise<{ guardianId: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const ctx = await requirePermission("guardians.view");
    const scope = await requireOrgScope(ctx);
    const { guardianId } = await params;
    return ok(await getGuardian(scope, guardianId));
  });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const ctx = await requirePermission("guardians.update");
    const scope = await requireOrgScope(ctx);
    const { guardianId } = await params;
    const body = await readJson(request);
    return ok(await updateGuardian(scope, guardianId, body));
  });
}
