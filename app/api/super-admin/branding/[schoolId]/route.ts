// GET   /api/super-admin/branding/[schoolId] — a school's branding (null defaults).
// PATCH /api/super-admin/branding/[schoolId] — create/update branding (partial).
// platform.branding.view / platform.branding.manage. Tenant derived from School.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { getBranding, updateBranding } from "@/lib/server/platform/branding-service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ schoolId: string }> }) {
  return handle(async () => {
    await requirePermission("platform.branding.view");
    const { schoolId } = await params;
    return ok(await getBranding(schoolId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ schoolId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("platform.branding.manage");
    const { schoolId } = await params;
    return ok(await updateBranding({ actor: { id: ctx.user.id, name: ctx.user.name ?? null }, schoolId, input: await readJson(request) }));
  });
}
