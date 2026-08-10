// POST /api/admissions/[applicationId]/convert — convert an approved application
// into a Student in one all-or-nothing transaction (creates the student, links
// guardians, transfers document metadata, records timeline, marks ENROLLED).
// Guarded against double conversion. Requires admissions.approve.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { requireOrgScope } from "@/lib/server/api/scope";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { convertApplication } from "@/lib/server/admissions/service";

type Ctx = { params: Promise<{ applicationId: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const ctx = await requirePermission("admissions.approve");
    const scope = await requireOrgScope(ctx);
    const { applicationId } = await params;
    // Body is optional (admissionNumber/class overrides); tolerate an empty body.
    let body: unknown = {};
    try {
      body = await readJson(request);
    } catch {
      body = {};
    }
    return ok(await convertApplication(scope, applicationId, body));
  });
}
