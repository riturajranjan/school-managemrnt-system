// POST /api/hr/documents/[documentId]/status { status: "verified"|"rejected"|"archived" }
// "archived" is the delete-equivalent — a document record is never hard-
// deleted. hr.manage.
import type { NextRequest } from "next/server";
import { handle, HttpError, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { setStaffDocumentStatus } from "@/lib/server/hr/documents";

const VALID = ["verified", "rejected", "archived"] as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    const { documentId } = await params;
    const body = (await readJson(request)) as { status?: unknown };
    if (typeof body.status !== "string" || !VALID.includes(body.status as (typeof VALID)[number])) {
      throw new HttpError("VALIDATION_ERROR", "Invalid status");
    }
    return ok(await setStaffDocumentStatus(scope, documentId, body.status as (typeof VALID)[number]));
  });
}
