// POST /api/accounting/journals/[journalId]/reverse — mirror-and-swap correction. accounting.reverse.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { reverseJournalEntry } from "@/lib/server/accounting/journals";

export async function POST(request: NextRequest, { params }: { params: Promise<{ journalId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("accounting.reverse");
    const scope = await requireOrgScope(ctx);
    const { journalId } = await params;
    const data = await reverseJournalEntry(scope, journalId, await readJson(request));
    return ok(data);
  });
}
