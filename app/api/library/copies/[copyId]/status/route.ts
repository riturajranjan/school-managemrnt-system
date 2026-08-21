// POST /api/library/copies/[copyId]/status { status: "available"|"damaged"|"archived" }
// Standalone status change for a copy NOT currently on loan. library.manage.
import type { NextRequest } from "next/server";
import { handle, HttpError, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { setCopyStatus } from "@/lib/server/library/copies";

const VALID = ["available", "damaged", "archived"] as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ copyId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("library.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "library");
    const { copyId } = await params;
    const body = (await readJson(request)) as { status?: unknown };
    if (typeof body.status !== "string" || !VALID.includes(body.status as (typeof VALID)[number])) {
      throw new HttpError("VALIDATION_ERROR", "Invalid status");
    }
    return ok(await setCopyStatus(scope, copyId, body.status as (typeof VALID)[number]));
  });
}
