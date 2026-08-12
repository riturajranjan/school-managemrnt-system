// GET   /api/super-admin/features/[schoolId] — effective features (plan default +
//        override + effective) for a school. platform.features.view.
// PATCH  /api/super-admin/features/[schoolId] — set/clear a single override.
//        platform.features.manage. Body: { featureKey, enabled: boolean | null }
//        (null clears the override → revert to the plan default).
import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { parseInput } from "@/lib/server/validation";
import { clearFeatureOverride, getEffectiveFeaturesForSchool, setFeatureOverride } from "@/lib/server/platform/features-service";

const patchSchema = z.object({
  featureKey: z.string().trim().min(1),
  enabled: z.boolean().nullable(), // null → clear the override
  reason: z.string().trim().max(200).optional(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ schoolId: string }> }) {
  return handle(async () => {
    await requirePermission("platform.features.view");
    const { schoolId } = await params;
    return ok(await getEffectiveFeaturesForSchool(schoolId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ schoolId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("platform.features.manage");
    const { schoolId } = await params;
    const { featureKey, enabled, reason } = parseInput(patchSchema, await readJson(request));
    const actor = { id: ctx.user.id, name: ctx.user.name ?? null };
    const result =
      enabled === null
        ? await clearFeatureOverride({ actor, schoolId, featureKey })
        : await setFeatureOverride({ actor, schoolId, featureKey, enabled, reason });
    return ok(result);
  });
}
