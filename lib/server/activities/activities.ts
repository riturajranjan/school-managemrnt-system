// Activity / Club master (Phase 9U). No parallel identity — coordinators
// are real Staff.id, members are real Student.id.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ActivityDto } from "@/lib/api/contracts";
import { resolveActivityBranch, staffDisplayName } from "./access";

type Row = {
  id: string; code: string; name: string; type: string; description: string | null; status: string; capacity: number | null;
  createdAt: Date; updatedAt: Date;
  _count: { memberships: number };
  staffAssignments: { staff: { firstName: string; lastName: string | null; displayName: string | null } }[];
};

const select = {
  id: true, code: true, name: true, type: true, description: true, status: true, capacity: true, createdAt: true, updatedAt: true,
  _count: { select: { memberships: { where: { status: "ACTIVE" } } } },
  staffAssignments: { where: { status: "ACTIVE" }, select: { staff: { select: { firstName: true, lastName: true, displayName: true } } } },
} satisfies Prisma.ActivitySelect;

function dto(a: Row): ActivityDto {
  return {
    id: a.id, code: a.code, name: a.name, type: a.type.toLowerCase() as ActivityDto["type"], description: a.description,
    status: a.status.toLowerCase() as ActivityDto["status"], capacity: a.capacity, memberCount: a._count.memberships,
    coordinatorNames: a.staffAssignments.map((s) => staffDisplayName(s.staff)),
    createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString(),
  };
}

export async function listActivities(scope: OrgScope, params: { type?: string; status?: string; search?: string } = {}): Promise<ActivityDto[]> {
  const where: Prisma.ActivityWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.type) where.type = params.type.toUpperCase() as never;
  if (params.status) where.status = params.status.toUpperCase() as never;
  if (params.search?.trim()) where.name = { contains: params.search.trim(), mode: "insensitive" };
  const rows = await prisma.activity.findMany({ where, select, orderBy: { name: "asc" } });
  return rows.map(dto);
}

async function requireActivityRow(scope: OrgScope, activityId: string): Promise<Row> {
  const row = await prisma.activity.findFirst({ where: { id: activityId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select });
  if (!row) throw new HttpError("ACTIVITY_NOT_FOUND", "Activity not found");
  return row;
}

export async function getActivity(scope: OrgScope, activityId: string): Promise<ActivityDto> {
  return dto(await requireActivityRow(scope, activityId));
}

export async function requireActivityInScope(scope: OrgScope, activityId: string): Promise<{ id: string; branchId: string; status: string }> {
  const row = await prisma.activity.findFirst({ where: { id: activityId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true, branchId: true, status: true } });
  if (!row) throw new HttpError("ACTIVITY_NOT_FOUND", "Activity not found");
  return row;
}

export const createActivitySchema = z.object({
  code: z.string().trim().min(1).max(24),
  name: z.string().trim().min(1).max(120),
  type: z.enum(["club", "sport", "cultural", "academic", "service", "other"]),
  description: z.string().trim().max(500).optional(),
  capacity: z.number().int().min(1).max(10_000).optional(),
});

export async function createActivity(scope: OrgScope, raw: unknown): Promise<ActivityDto> {
  const input = parseInput(createActivitySchema, raw);
  const branchId = await resolveActivityBranch(scope);
  let row;
  try {
    row = await prisma.activity.create({
      data: { tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, code: input.code, name: input.name, type: input.type.toUpperCase() as never, description: input.description, capacity: input.capacity },
      select,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError("ACTIVITY_CODE_EXISTS", "An activity with this code already exists");
    throw e;
  }
  await recordAudit(prisma, scope, "ACTIVITY_CREATED", "Activity", row.id, { code: row.code, type: input.type });
  return dto(row);
}

export const updateActivitySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  capacity: z.number().int().min(1).max(10_000).nullable().optional(),
  status: z.enum(["active", "inactive", "archived"]).optional(),
});

export async function updateActivity(scope: OrgScope, activityId: string, raw: unknown): Promise<ActivityDto> {
  const input = parseInput(updateActivitySchema, raw);
  const current = await requireActivityRow(scope, activityId);
  const row = await prisma.activity.update({
    where: { id: activityId },
    data: { name: input.name, description: input.description, capacity: input.capacity, status: input.status ? (input.status.toUpperCase() as never) : undefined },
    select,
  });
  await recordAudit(prisma, scope, input.status && input.status.toUpperCase() !== current.status ? "ACTIVITY_STATUS_CHANGED" : "ACTIVITY_UPDATED", "Activity", activityId, {});
  return dto(row);
}
