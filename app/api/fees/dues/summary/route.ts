// GET /api/fees/dues/summary — school-wide dues/overdue/aging summary. fees.view.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getDuesSummary } from "@/lib/server/fees/dues";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("fees.view");
    const scope = await requireOrgScope(ctx);
    const data = await getDuesSummary(scope);
    return ok(data);
  });
}
