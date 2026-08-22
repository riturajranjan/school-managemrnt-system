// POST /api/assets/[assetId]/assign — assign to a real, active Staff member.
// Concurrency-safe: dual guard (conditional status update + partial unique
// index). assets.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { assignAsset } from "@/lib/server/assets/assignments";

export async function POST(request: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("assets.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "assets");
    const { assetId } = await params;
    const body = await readJson(request);
    const merged = typeof body === "object" && body !== null ? { ...body, assetId } : { assetId };
    return ok(await assignAsset(scope, merged));
  });
}
