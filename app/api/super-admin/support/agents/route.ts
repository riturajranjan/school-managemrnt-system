// GET /api/super-admin/support/agents — assignable platform admins (active).
// platform.support.view (used by the assignee picker).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { listAgents } from "@/lib/server/platform/support-service";

export async function GET(_request: NextRequest) {
  return handle(async () => {
    await requirePermission("platform.support.view");
    return ok(await listAgents());
  });
}
