// POST /api/super-admin/domains/[id]/status — MANUAL domain lifecycle change.
// Honest: verification is a deliberate admin action, never a fake DNS check.
// platform.domains.manage.
import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { parseInput } from "@/lib/server/validation";
import { setDomainStatus } from "@/lib/server/platform/domains-service";

const statusSchema = z.object({ status: z.enum(["pending", "verified", "failed", "disabled"]) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("platform.domains.manage");
    const { id } = await params;
    const { status } = parseInput(statusSchema, await readJson(request));
    return ok(await setDomainStatus({ actor: { id: ctx.user.id, name: ctx.user.name ?? null }, domainId: id, status }));
  });
}
