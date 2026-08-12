// GET  /api/super-admin/schools/[schoolId]/addons — a school's add-on assignments.
// POST /api/super-admin/schools/[schoolId]/addons — assign an add-on { addOnId }.
// platform.addons.view / platform.addons.manage. Tenant derived from the School.
import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { parseInput } from "@/lib/server/validation";
import { assignAddOn, listSchoolAddOns } from "@/lib/server/platform/addons-service";

const assignSchema = z.object({ addOnId: z.string().min(1) });

export async function GET(_request: NextRequest, { params }: { params: Promise<{ schoolId: string }> }) {
  return handle(async () => {
    await requirePermission("platform.addons.view");
    const { schoolId } = await params;
    return ok(await listSchoolAddOns(schoolId));
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ schoolId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("platform.addons.manage");
    const { schoolId } = await params;
    const { addOnId } = parseInput(assignSchema, await readJson(request));
    return ok(await assignAddOn({ id: ctx.user.id, name: ctx.user.name ?? null }, schoolId, addOnId));
  });
}
