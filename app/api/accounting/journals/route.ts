// GET  /api/accounting/journals — list/filter journal entries. accounting.view.
// POST /api/accounting/journals — create + post a balanced manual journal. accounting.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createAndPostJournalEntry, listJournalEntries } from "@/lib/server/accounting/journals";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("accounting.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const page = singleParam(sp, "page"), pageSize = singleParam(sp, "pageSize");
    const { data, meta } = await listJournalEntries(scope, {
      sourceType: singleParam(sp, "sourceType"), status: singleParam(sp, "status"), from: singleParam(sp, "from"), to: singleParam(sp, "to"),
      page: page ? Number(page) : undefined, pageSize: pageSize ? Number(pageSize) : undefined,
    });
    return ok(data, meta);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("accounting.manage");
    const scope = await requireOrgScope(ctx);
    const data = await createAndPostJournalEntry(scope, await readJson(request));
    return ok(data);
  });
}
