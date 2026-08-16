// GET /api/accounting/journals/[journalId] — journal detail with lines. accounting.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getJournalEntry } from "@/lib/server/accounting/journals";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ journalId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("accounting.view");
    const scope = await requireOrgScope(ctx);
    const { journalId } = await params;
    const data = await getJournalEntry(scope, journalId);
    return ok(data);
  });
}
