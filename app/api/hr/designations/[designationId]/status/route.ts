// POST /api/hr/designations/[designationId]/status { status: "active"|"archived" }
// hr.manage.
import type { NextRequest } from "next/server";
import { handle, HttpError, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { setDesignationStatus } from "@/lib/server/hr/designations";

const VALID = ["active", "archived"] as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ designationId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    const { designationId } = await params;
    const body = (await readJson(request)) as { status?: unknown };
    if (typeof body.status !== "string" || !VALID.includes(body.status as (typeof VALID)[number])) throw new HttpError("VALIDATION_ERROR", "Invalid status");
    return ok(await setDesignationStatus(scope, designationId, body.status as (typeof VALID)[number]));
  });
}
