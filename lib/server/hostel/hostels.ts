// Hostel master (Phase 9Q) — the top-level real entity (mock UI called this
// a "building", but structurally it is the top-level hostel; no separate
// Block/Floor entity exists — see the schema's own doc comment).
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { HostelDto } from "@/lib/api/contracts";
import { resolveHostelBranch } from "./access";

type Row = {
  id: string; code: string; name: string; description: string | null; genderPolicy: string | null; status: string;
  createdAt: Date; updatedAt: Date;
  _count: { rooms: number };
};

const select = {
  id: true, code: true, name: true, description: true, genderPolicy: true, status: true, createdAt: true, updatedAt: true,
  _count: { select: { rooms: true } },
} satisfies Prisma.HostelSelect;

function dto(h: Row): HostelDto {
  return {
    id: h.id, code: h.code, name: h.name, description: h.description,
    genderPolicy: h.genderPolicy ? (h.genderPolicy.toLowerCase() as HostelDto["genderPolicy"]) : null,
    status: h.status.toLowerCase() as HostelDto["status"], roomCount: h._count.rooms,
    createdAt: h.createdAt.toISOString(), updatedAt: h.updatedAt.toISOString(),
  };
}

export async function listHostels(scope: OrgScope, params: { status?: string } = {}): Promise<HostelDto[]> {
  const where: Prisma.HostelWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.status) where.status = params.status.toUpperCase() as never;
  const rows = await prisma.hostel.findMany({ where, select, orderBy: { name: "asc" } });
  return rows.map(dto);
}

async function requireHostelRow(scope: OrgScope, hostelId: string): Promise<Row> {
  const row = await prisma.hostel.findFirst({ where: { id: hostelId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select });
  if (!row) throw new HttpError("HOSTEL_NOT_FOUND", "Hostel not found");
  return row;
}

export async function getHostel(scope: OrgScope, hostelId: string): Promise<HostelDto> {
  return dto(await requireHostelRow(scope, hostelId));
}

/** Validate a hostelId belongs to this school/branch scope. Used by rooms/assignments. */
export async function requireHostelInScope(scope: OrgScope, hostelId: string): Promise<{ id: string; branchId: string }> {
  const h = await prisma.hostel.findFirst({ where: { id: hostelId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true, branchId: true } });
  if (!h) throw new HttpError("HOSTEL_NOT_FOUND", "Hostel not found");
  return h;
}

export const createHostelSchema = z.object({
  code: z.string().trim().min(1).max(24),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  genderPolicy: z.enum(["boys", "girls", "mixed"]).optional(),
});

export async function createHostel(scope: OrgScope, raw: unknown): Promise<HostelDto> {
  const input = parseInput(createHostelSchema, raw);
  const branchId = await resolveHostelBranch(scope);
  let row;
  try {
    row = await prisma.hostel.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, code: input.code, name: input.name,
        description: input.description, genderPolicy: input.genderPolicy ? (input.genderPolicy.toUpperCase() as never) : undefined,
      },
      select,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError("HOSTEL_CODE_EXISTS", "A hostel with this code already exists");
    throw e;
  }
  await recordAudit(prisma, scope, "HOSTEL_CREATED", "Hostel", row.id, { code: row.code, name: row.name });
  return dto(row);
}

export const updateHostelSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  genderPolicy: z.enum(["boys", "girls", "mixed"]).nullable().optional(),
  status: z.enum(["active", "maintenance", "archived"]).optional(),
});

export async function updateHostel(scope: OrgScope, hostelId: string, raw: unknown): Promise<HostelDto> {
  const input = parseInput(updateHostelSchema, raw);
  await requireHostelRow(scope, hostelId);
  const row = await prisma.hostel.update({
    where: { id: hostelId },
    data: {
      name: input.name, description: input.description,
      genderPolicy: input.genderPolicy === undefined ? undefined : input.genderPolicy === null ? null : (input.genderPolicy.toUpperCase() as never),
      status: input.status ? (input.status.toUpperCase() as never) : undefined,
    },
    select,
  });
  await recordAudit(prisma, scope, "HOSTEL_UPDATED", "Hostel", hostelId, input);
  return dto(row);
}
