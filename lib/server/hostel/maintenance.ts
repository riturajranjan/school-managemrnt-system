// Hostel Maintenance (Phase C1) — facility-level, NOT tied to a resident.
// Lifecycle: OPEN -[assign]-> ASSIGNED -[start]-> IN_PROGRESS -[complete]->
// COMPLETED, or OPEN/ASSIGNED -[cancel]-> CANCELLED. Deliberately no
// vendor/invoice/cost/purchase/asset fields — mirrors AssetMaintenanceRecord's
// own structurally-simple, non-financial-workflow precedent.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { HostelIssuePriorityDto, HostelMaintenanceRequestDto, HostelMaintenanceStatusDto } from "@/lib/api/contracts";
import { requireHostelInScope } from "./hostels";
import { requireRoomInScope } from "./rooms";
import { staffDisplayName } from "./access";

const PRIORITY_TO_DB: Record<HostelIssuePriorityDto, string> = { low: "LOW", normal: "NORMAL", high: "HIGH", urgent: "URGENT" };
const PRIORITY_TO_UI: Record<string, HostelIssuePriorityDto> = { LOW: "low", NORMAL: "normal", HIGH: "high", URGENT: "urgent" };
const STATUS_TO_UI: Record<string, HostelMaintenanceStatusDto> = { OPEN: "open", ASSIGNED: "assigned", IN_PROGRESS: "in_progress", COMPLETED: "completed", CANCELLED: "cancelled" };

const select = {
  id: true, hostelId: true, roomId: true, title: true, description: true, priority: true, status: true,
  assignedStaffId: true, reportedByName: true, reportedAt: true, completedAt: true, notes: true, createdAt: true, updatedAt: true,
  hostel: { select: { name: true } },
  room: { select: { roomNumber: true } },
  assignedStaff: { select: { firstName: true, lastName: true, displayName: true } },
} satisfies Prisma.HostelMaintenanceRequestSelect;

type Row = Prisma.HostelMaintenanceRequestGetPayload<{ select: typeof select }>;

function dto(r: Row): HostelMaintenanceRequestDto {
  return {
    id: r.id, hostelId: r.hostelId, hostelName: r.hostel.name, roomId: r.roomId, roomNumber: r.room?.roomNumber ?? null,
    title: r.title, description: r.description, priority: PRIORITY_TO_UI[r.priority], status: STATUS_TO_UI[r.status],
    assignedStaffId: r.assignedStaffId, assignedStaffName: r.assignedStaff ? staffDisplayName(r.assignedStaff) : null,
    reportedByName: r.reportedByName, reportedAt: r.reportedAt.toISOString(), completedAt: r.completedAt?.toISOString() ?? null, notes: r.notes,
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  };
}

export const listHostelMaintenanceSchema = z.object({
  status: z.enum(["open", "assigned", "in_progress", "completed", "cancelled"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  hostelId: z.string().optional(),
  assignedStaffId: z.string().optional(),
  search: z.string().trim().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
});

export async function listHostelMaintenance(scope: OrgScope, raw: unknown): Promise<{ data: HostelMaintenanceRequestDto[]; meta: { page: number; pageSize: number; total: number; totalPages: number } }> {
  const input = parseInput(listHostelMaintenanceSchema, raw);
  const where: Prisma.HostelMaintenanceRequestWhereInput = {
    schoolId: scope.schoolId,
    ...(scope.branchId ? { branchId: scope.branchId } : {}),
    ...(input.status ? { status: input.status.toUpperCase() as never } : {}),
    ...(input.priority ? { priority: PRIORITY_TO_DB[input.priority] as never } : {}),
    ...(input.hostelId ? { hostelId: input.hostelId } : {}),
    ...(input.assignedStaffId ? { assignedStaffId: input.assignedStaffId } : {}),
    ...(input.search?.trim() ? { OR: [{ title: { contains: input.search.trim(), mode: "insensitive" } }, { description: { contains: input.search.trim(), mode: "insensitive" } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.hostelMaintenanceRequest.count({ where }),
    prisma.hostelMaintenanceRequest.findMany({ where, select, orderBy: [{ status: "asc" }, { createdAt: "desc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
  ]);
  return { data: rows.map(dto), meta: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.max(1, Math.ceil(total / input.pageSize)) } };
}

async function requireMaintenanceInScope(scope: OrgScope, id: string): Promise<Row> {
  const row = await prisma.hostelMaintenanceRequest.findFirst({ where: { id, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select });
  if (!row) throw new HttpError("HOSTEL_MAINTENANCE_NOT_FOUND", "Maintenance request not found");
  return row;
}

export async function getHostelMaintenance(scope: OrgScope, id: string): Promise<HostelMaintenanceRequestDto> {
  return dto(await requireMaintenanceInScope(scope, id));
}

export const createHostelMaintenanceSchema = z.object({
  hostelId: z.string().min(1),
  roomId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(1000),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
});

export async function createHostelMaintenance(scope: OrgScope, raw: unknown): Promise<HostelMaintenanceRequestDto> {
  const input = parseInput(createHostelMaintenanceSchema, raw);
  const hostel = await requireHostelInScope(scope, input.hostelId);
  if (input.roomId) {
    const room = await requireRoomInScope(scope, input.roomId);
    if (room.hostelId !== input.hostelId) throw new HttpError("VALIDATION_ERROR", "This room does not belong to the selected hostel");
  }

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.hostelMaintenanceRequest.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: hostel.branchId,
        hostelId: input.hostelId, roomId: input.roomId ?? null, title: input.title, description: input.description, priority: PRIORITY_TO_DB[input.priority] as never,
        reportedByUserId: scope.actor.id, reportedByName: scope.actor.name,
      },
      select: { id: true },
    });
    await recordAudit(tx, scope, "HOSTEL_MAINTENANCE_CREATED", "HostelMaintenanceRequest", row.id, { hostelId: input.hostelId, roomId: input.roomId, priority: input.priority });
    return row.id;
  });
  return getHostelMaintenance(scope, created);
}

async function requireActiveStaffInScope(scope: OrgScope, staffId: string): Promise<void> {
  const staff = await prisma.staff.findFirst({ where: { id: staffId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (!staff) throw new HttpError("INVALID_HOSTEL_STAFF", "Assignee must be a real, active staff member in this school");
}

const assignSchema = z.object({ staffId: z.string().min(1) });

export async function assignHostelMaintenance(scope: OrgScope, id: string, raw: unknown): Promise<HostelMaintenanceRequestDto> {
  const input = parseInput(assignSchema, raw);
  const current = await requireMaintenanceInScope(scope, id);
  if (current.status === "COMPLETED" || current.status === "CANCELLED") throw new HttpError("INVALID_HOSTEL_MAINTENANCE_TRANSITION", `Cannot assign a request in "${current.status.toLowerCase()}" status`);
  await requireActiveStaffInScope(scope, input.staffId);
  await prisma.$transaction(async (tx) => {
    await tx.hostelMaintenanceRequest.update({ where: { id }, data: { assignedStaffId: input.staffId, assignedAt: new Date(), status: current.status === "OPEN" ? "ASSIGNED" : current.status } });
    await recordAudit(tx, scope, "HOSTEL_MAINTENANCE_ASSIGNED", "HostelMaintenanceRequest", id, { staffId: input.staffId });
  });
  return getHostelMaintenance(scope, id);
}

export async function startHostelMaintenance(scope: OrgScope, id: string): Promise<HostelMaintenanceRequestDto> {
  const current = await requireMaintenanceInScope(scope, id);
  if (current.status !== "ASSIGNED") throw new HttpError("INVALID_HOSTEL_MAINTENANCE_TRANSITION", `Only an assigned request can be started (this one is "${current.status.toLowerCase()}")`);
  await prisma.$transaction(async (tx) => {
    await tx.hostelMaintenanceRequest.update({ where: { id }, data: { status: "IN_PROGRESS" } });
    await recordAudit(tx, scope, "HOSTEL_MAINTENANCE_STATUS_CHANGED", "HostelMaintenanceRequest", id, { from: current.status, to: "IN_PROGRESS" });
  });
  return getHostelMaintenance(scope, id);
}

const completeSchema = z.object({ notes: z.string().trim().max(1000).optional() });

export async function completeHostelMaintenance(scope: OrgScope, id: string, raw: unknown): Promise<HostelMaintenanceRequestDto> {
  const input = parseInput(completeSchema, raw);
  const current = await requireMaintenanceInScope(scope, id);
  if (current.status !== "ASSIGNED" && current.status !== "IN_PROGRESS") throw new HttpError("INVALID_HOSTEL_MAINTENANCE_TRANSITION", `Only an assigned or in-progress request can be completed (this one is "${current.status.toLowerCase()}")`);
  await prisma.$transaction(async (tx) => {
    await tx.hostelMaintenanceRequest.update({ where: { id }, data: { status: "COMPLETED", completedAt: new Date(), notes: input.notes ?? current.notes } });
    await recordAudit(tx, scope, "HOSTEL_MAINTENANCE_COMPLETED", "HostelMaintenanceRequest", id);
  });
  return getHostelMaintenance(scope, id);
}

export async function cancelHostelMaintenance(scope: OrgScope, id: string): Promise<HostelMaintenanceRequestDto> {
  const current = await requireMaintenanceInScope(scope, id);
  if (current.status !== "OPEN" && current.status !== "ASSIGNED") throw new HttpError("INVALID_HOSTEL_MAINTENANCE_TRANSITION", `Only an open or assigned request can be cancelled (this one is "${current.status.toLowerCase()}")`);
  await prisma.$transaction(async (tx) => {
    await tx.hostelMaintenanceRequest.update({ where: { id }, data: { status: "CANCELLED" } });
    await recordAudit(tx, scope, "HOSTEL_MAINTENANCE_STATUS_CHANGED", "HostelMaintenanceRequest", id, { from: current.status, to: "CANCELLED" });
  });
  return getHostelMaintenance(scope, id);
}
