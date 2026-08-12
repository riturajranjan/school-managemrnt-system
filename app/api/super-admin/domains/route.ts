// GET  /api/super-admin/domains[?school=<id>] — domain records (optionally by school).
// POST /api/super-admin/domains — register a hostname for a school.
// platform.domains.view / platform.domains.manage.
import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { parseInput } from "@/lib/server/validation";
import { createDomain, listDomains } from "@/lib/server/platform/domains-service";

const createSchema = z.object({
  schoolId: z.string().min(1),
  hostname: z.string().trim().min(1).max(253),
  type: z.enum(["subdomain", "custom"]).optional(),
});

export async function GET(request: NextRequest) {
  return handle(async () => {
    await requirePermission("platform.domains.view");
    const school = singleParam(request.nextUrl.searchParams, "school") ?? singleParam(request.nextUrl.searchParams, "schoolId");
    return ok(await listDomains(school ?? undefined));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("platform.domains.manage");
    const input = parseInput(createSchema, await readJson(request));
    return ok(await createDomain({ actor: { id: ctx.user.id, name: ctx.user.name ?? null }, ...input }));
  });
}
