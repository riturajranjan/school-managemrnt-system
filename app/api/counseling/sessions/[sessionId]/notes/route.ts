// GET/POST /api/counseling/sessions/[sessionId]/notes — CONFIDENTIAL.
// counseling.viewConfidential AND the session's case must be assigned to
// the caller's own Staff identity (enforced in the service layer, which
// returns 404 rather than 403 on an ownership mismatch — see
// lib/server/counseling/access.ts's requireOwnCaseForConfidential).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { createNote, listNotesForSession } from "@/lib/server/counseling/notes";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  return handle(async () => {
    const { sessionId } = await params;
    const ctx = await requirePermission("counseling.viewConfidential");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "counseling");
    return ok(await listNotesForSession(scope, sessionId));
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  return handle(async () => {
    const { sessionId } = await params;
    const ctx = await requirePermission("counseling.viewConfidential");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "counseling");
    return ok(await createNote(scope, sessionId, await readJson(request)));
  });
}
