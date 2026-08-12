// POST /api/super-admin/schools/[schoolId]/marketplace/[appId]/install — install
// (or re-enable) an app for a school. platform.marketplace.manage. Tenant derived
// from the School. Optional body { configuration } is NON-SECRET metadata only;
// secret-looking keys are rejected. No OAuth/token exchange happens here.
import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { parseInput } from "@/lib/server/validation";
import { installApp } from "@/lib/server/platform/marketplace-service";

const schema = z.object({ configuration: z.record(z.string(), z.unknown()).optional() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ schoolId: string; appId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("platform.marketplace.manage");
    const { schoolId, appId } = await params;
    const body = await readJson(request).catch(() => ({}));
    const { configuration } = parseInput(schema, body ?? {});
    return ok(await installApp({ id: ctx.user.id, name: ctx.user.name ?? null }, schoolId, appId, configuration));
  });
}
