// POST /api/transport/trips/[tripId]/students/[tripStudentId]/drop
// { status: "onboard" | "dropped" } — server-timestamped, real actor.
// transport.manage OR the trip's own assigned driver/attendant.
import type { NextRequest } from "next/server";
import { handle, requireAuth } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { markStudentDrop } from "@/lib/server/transport/trips";

export async function POST(request: NextRequest, { params }: { params: Promise<{ tripId: string; tripStudentId: string }> }) {
  return handle(async () => {
    const ctx = await requireAuth();
    const scope = await requireOrgScope(ctx);
    const { tripId, tripStudentId } = await params;
    return ok(await markStudentDrop(scope, tripId, tripStudentId, await readJson(request), ctx.permissions.has("transport.manage")));
  });
}
