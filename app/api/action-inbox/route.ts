// GET /api/action-inbox?category=&priority= — derived, personalized action
// items aggregated live from existing real domains (no ActionItem table).
// dashboard.view — the same broad gate as My Day/the Main Dashboard; each
// item's own visibility still mirrors its source domain's real authorization
// (see lib/server/action-inbox/service.ts).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getActionInbox } from "@/lib/server/action-inbox/service";
import type { ActionCategoryDto, ActionPriorityDto } from "@/lib/api/contracts";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("dashboard.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const items = await getActionInbox(
      scope,
      { communication: ctx.permissions.has("communication.send") },
      { category: singleParam(sp, "category") as ActionCategoryDto | undefined, priority: singleParam(sp, "priority") as ActionPriorityDto | undefined },
    );
    return ok(items);
  });
}
