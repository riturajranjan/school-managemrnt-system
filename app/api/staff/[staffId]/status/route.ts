// POST /api/staff/[staffId]/status { status: "active" | "inactive" | "archived" }
// — change a staff member's status. hr.manage.
import type { NextRequest } from "next/server";
import { handle, HttpError, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { setStaffStatus } from "@/lib/server/staff/service";

const VALID = ["active", "inactive", "archived"] as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ staffId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    const { staffId } = await params;
    const body = (await readJson(request)) as { status?: unknown };
    if (typeof body.status !== "string" || !VALID.includes(body.status as (typeof VALID)[number])) {
      throw new HttpError("VALIDATION_ERROR", 'status must be "active", "inactive", or "archived"');
    }
    return ok(await setStaffStatus(scope, staffId, body.status as (typeof VALID)[number]));
  });
}
