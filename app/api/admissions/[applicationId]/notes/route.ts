// POST /api/admissions/[applicationId]/notes — add an internal note to an
// application. Protected by admissions.update.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { requireOrgScope } from "@/lib/server/api/scope";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { addApplicationNote } from "@/lib/server/admissions/service";

type Ctx = { params: Promise<{ applicationId: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const ctx = await requirePermission("admissions.update");
    const scope = await requireOrgScope(ctx);
    const { applicationId } = await params;
    const body = await readJson(request);
    return ok(await addApplicationNote(scope, applicationId, body));
  });
}
