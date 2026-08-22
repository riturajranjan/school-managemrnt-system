// POST /api/hr/departments/[departmentId]/status { status: "active"|"archived" }
// Archive, never hard-delete — Staff FKs stay valid regardless. hr.manage.
import type { NextRequest } from "next/server";
import { handle, HttpError, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { setDepartmentStatus } from "@/lib/server/hr/departments";

const VALID = ["active", "archived"] as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ departmentId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    const { departmentId } = await params;
    const body = (await readJson(request)) as { status?: unknown };
    if (typeof body.status !== "string" || !VALID.includes(body.status as (typeof VALID)[number])) throw new HttpError("VALIDATION_ERROR", "Invalid status");
    return ok(await setDepartmentStatus(scope, departmentId, body.status as (typeof VALID)[number]));
  });
}
