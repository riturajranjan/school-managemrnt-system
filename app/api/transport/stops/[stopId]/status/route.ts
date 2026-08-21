// POST /api/transport/stops/[stopId]/status { status } — transport.manage.
import type { NextRequest } from "next/server";
import { handle, HttpError, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { setStopStatus } from "@/lib/server/transport/stops";

const VALID = ["active", "temporary", "unsafe", "inactive"] as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ stopId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("transport.manage");
    const scope = await requireOrgScope(ctx);
    const { stopId } = await params;
    const body = (await readJson(request)) as { status?: unknown };
    if (typeof body.status !== "string" || !VALID.includes(body.status as (typeof VALID)[number])) {
      throw new HttpError("VALIDATION_ERROR", "Invalid status");
    }
    return ok(await setStopStatus(scope, stopId, body.status as (typeof VALID)[number]));
  });
}
