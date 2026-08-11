// GET /api/super-admin/search?q=…&type=school,invoice — real Super Admin global
// search. Fails closed: the caller must hold at least one platform view
// permission; results are further filtered per-category by real permissions.
import type { NextRequest } from "next/server";
import { handle, requireAnyPermission } from "@/lib/server/api/guard";
import { singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { ALL_SEARCH_TYPES, authorizedTypes, globalSearch, type SearchResultType } from "@/lib/server/platform/search-service";

const VIEW_PERMS = ["platform.schools.view", "platform.subscriptions.view", "platform.invoices.view", "platform.payments.view", "platform.plans.view"];

export async function GET(request: NextRequest) {
  return handle(async () => {
    // At least one searchable-category permission — a tenant/school role has none
    // and is rejected (403), so it cannot enumerate platform records.
    const ctx = await requireAnyPermission(VIEW_PERMS);
    const sp = request.nextUrl.searchParams;
    const q = (singleParam(sp, "q") ?? "").slice(0, 100);

    const typeRaw = singleParam(sp, "type");
    const requested = typeRaw
      ? (typeRaw.split(",").map((t) => t.trim()).filter((t) => (ALL_SEARCH_TYPES as string[]).includes(t)) as SearchResultType[])
      : undefined;

    const types = authorizedTypes(ctx.permissions, requested);
    return ok(await globalSearch(q, types));
  });
}
