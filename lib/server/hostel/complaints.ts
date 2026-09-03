// Hostel Complaints (Phase C1). Lifecycle: OPEN -[assign]-> ASSIGNED
// -[start]-> IN_PROGRESS -[resolve]-> RESOLVED -[close]-> CLOSED. Assigned
// staff is always a real, active, in-school Staff.id. hostelId/roomId are
// snapshotted server-side from the complainant's current active hostel
// residency at creation time — never client-supplied.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { HostelComplaintCategoryDto, HostelComplaintDto, HostelComplaintStatusDto, HostelIssuePriorityDto } from "@/lib/api/contracts";
import { requireActiveResident, staffDisplayName, studentDisplayName } from "./access";

const CATEGORY_TO_DB: Record<HostelComplaintCategoryDto, string> = {
  electricity: "ELECTRICITY", water: "WATER", furniture: "FURNITURE", cleaning: "CLEANING", bathroom: "BATHROOM",
  wifi: "WIFI", roommate: "ROOMMATE", safety: "SAFETY", mess: "MESS", other: "OTHER",
};
const CATEGORY_TO_UI: Record<string, HostelComplaintCategoryDto> = Object.fromEntries(Object.entries(CATEGORY_TO_DB).map(([ui, db]) => [db, ui])) as never;
const PRIORITY_TO_DB: Record<HostelIssuePriorityDto, string> = { low: "LOW", normal: "NORMAL", high: "HIGH", urgent: "URGENT" };
const PRIORITY_TO_UI: Record<string, HostelIssuePriorityDto> = { LOW: "low", NORMAL: "normal", HIGH: "high", URGENT: "urgent" };
const STATUS_TO_UI: Record<string, HostelComplaintStatusDto> = { OPEN: "open", ASSIGNED: "assigned", IN_PROGRESS: "in_progress", RESOLVED: "resolved", CLOSED: "closed" };

const select = {
  id: true, studentId: true, hostelId: true, roomId: true, category: true, title: true, description: true, priority: true, status: true,
  assignedStaffId: true, resolutionNotes: true, resolvedAt: true, createdAt: true, updatedAt: true,
  student: { select: { firstName: true, lastName: true, admissionNumber: true } },
  hostel: { select: { name: true } },
  room: { select: { roomNumber: true } },
  assignedStaff: { select: { firstName: true, lastName: true, displayName: true } },
} satisfies Prisma.HostelComplaintSelect;

type Row = Prisma.HostelComplaintGetPayload<{ select: typeof select }>;

function dto(r: Row): HostelComplaintDto {
  return {
    id: r.id, studentId: r.studentId, studentName: studentDisplayName(r.student), admissionNumber: r.student.admissionNumber,
    hostelId: r.hostelId, hostelName: r.hostel.name, roomId: r.roomId, roomNumber: r.room?.roomNumber ?? null,
    category: CATEGORY_TO_UI[r.category], title: r.title, description: r.description, priority: PRIORITY_TO_UI[r.priority], status: STATUS_TO_UI[r.status],
    assignedStaffId: r.assignedStaffId, assignedStaffName: r.assignedStaff ? staffDisplayName(r.assignedStaff) : null,
    resolutionNotes: r.resolutionNotes, resolvedAt: r.resolvedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  };
}

export const listHostelComplaintsSchema = z.object({
  status: z.enum(["open", "assigned", "in_progress", "resolved", "closed"]).optional(),
  category: z.enum(["electricity", "water", "furniture", "cleaning", "bathroom", "wifi", "roommate", "safety", "mess", "other"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  studentId: z.string().optional(),
  hostelId: z.string().optional(),
  assignedStaffId: z.string().optional(),
  search: z.string().trim().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
});

export async function listHostelComplaints(scope: OrgScope, raw: unknown): Promise<{ data: HostelComplaintDto[]; meta: { page: number; pageSize: number; total: number; totalPages: number } }> {
  const input = parseInput(listHostelComplaintsSchema, raw);
  const where: Prisma.HostelComplaintWhereInput = {
    schoolId: scope.schoolId,
    ...(scope.branchId ? { branchId: scope.branchId } : {}),
    ...(input.status ? { status: input.status.toUpperCase() as never } : {}),
    ...(input.category ? { category: CATEGORY_TO_DB[input.category] as never } : {}),
    ...(input.priority ? { priority: PRIORITY_TO_DB[input.priority] as never } : {}),
    ...(input.studentId ? { studentId: input.studentId } : {}),
    ...(input.hostelId ? { hostelId: input.hostelId } : {}),
    ...(input.assignedStaffId ? { assignedStaffId: input.assignedStaffId } : {}),
    ...(input.search?.trim()
      ? { OR: [{ title: { contains: input.search.trim(), mode: "insensitive" } }, { description: { contains: input.search.trim(), mode: "insensitive" } }, { student: { admissionNumber: { contains: input.search.trim(), mode: "insensitive" } } }] }
      : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.hostelComplaint.count({ where }),
    prisma.hostelComplaint.findMany({ where, select, orderBy: [{ status: "asc" }, { createdAt: "desc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
  ]);
  return { data: rows.map(dto), meta: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.max(1, Math.ceil(total / input.pageSize)) } };
}

async function requireComplaintInScope(scope: OrgScope, id: string): Promise<Row> {
  const row = await prisma.hostelComplaint.findFirst({ where: { id, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select });
  if (!row) throw new HttpError("HOSTEL_COMPLAINT_NOT_FOUND", "Complaint not found");
  return row;
}

export async function getHostelComplaint(scope: OrgScope, id: string): Promise<HostelComplaintDto> {
  return dto(await requireComplaintInScope(scope, id));
}

export const createHostelComplaintSchema = z.object({
  studentId: z.string().min(1),
  category: z.enum(["electricity", "water", "furniture", "cleaning", "bathroom", "wifi", "roommate", "safety", "mess", "other"]),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(1000),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
});

export async function createHostelComplaint(scope: OrgScope, raw: unknown): Promise<HostelComplaintDto> {
  const input = parseInput(createHostelComplaintSchema, raw);
  const residency = await requireActiveResident(scope, input.studentId);

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.hostelComplaint.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: residency.branchId,
        studentId: input.studentId, hostelId: residency.hostelId, roomId: residency.roomId,
        category: CATEGORY_TO_DB[input.category] as never, title: input.title, description: input.description, priority: PRIORITY_TO_DB[input.priority] as never,
        createdByUserId: scope.actor.id, createdByName: scope.actor.name,
      },
      select: { id: true },
    });
    await recordAudit(tx, scope, "HOSTEL_COMPLAINT_CREATED", "HostelComplaint", row.id, { studentId: input.studentId, category: input.category, priority: input.priority });
    return row.id;
  });
  return getHostelComplaint(scope, created);
}

async function requireActiveStaffInScope(scope: OrgScope, staffId: string): Promise<void> {
  const staff = await prisma.staff.findFirst({ where: { id: staffId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (!staff) throw new HttpError("INVALID_HOSTEL_STAFF", "Assignee must be a real, active staff member in this school");
}

const assignSchema = z.object({ staffId: z.string().min(1) });

export async function assignHostelComplaint(scope: OrgScope, id: string, raw: unknown): Promise<HostelComplaintDto> {
  const input = parseInput(assignSchema, raw);
  const current = await requireComplaintInScope(scope, id);
  if (current.status === "RESOLVED" || current.status === "CLOSED") throw new HttpError("INVALID_HOSTEL_COMPLAINT_TRANSITION", `Cannot assign a complaint in "${current.status.toLowerCase()}" status`);
  await requireActiveStaffInScope(scope, input.staffId);
  await prisma.$transaction(async (tx) => {
    await tx.hostelComplaint.update({ where: { id }, data: { assignedStaffId: input.staffId, assignedAt: new Date(), status: current.status === "OPEN" ? "ASSIGNED" : current.status } });
    await recordAudit(tx, scope, "HOSTEL_COMPLAINT_ASSIGNED", "HostelComplaint", id, { staffId: input.staffId });
  });
  return getHostelComplaint(scope, id);
}

export async function startHostelComplaint(scope: OrgScope, id: string): Promise<HostelComplaintDto> {
  const current = await requireComplaintInScope(scope, id);
  if (current.status !== "ASSIGNED") throw new HttpError("INVALID_HOSTEL_COMPLAINT_TRANSITION", `Only an assigned complaint can be started (this one is "${current.status.toLowerCase()}")`);
  await prisma.$transaction(async (tx) => {
    await tx.hostelComplaint.update({ where: { id }, data: { status: "IN_PROGRESS" } });
    await recordAudit(tx, scope, "HOSTEL_COMPLAINT_STATUS_CHANGED", "HostelComplaint", id, { from: current.status, to: "IN_PROGRESS" });
  });
  return getHostelComplaint(scope, id);
}

const resolveSchema = z.object({ resolutionNotes: z.string().trim().min(1).max(1000) });

export async function resolveHostelComplaint(scope: OrgScope, id: string, raw: unknown): Promise<HostelComplaintDto> {
  const input = parseInput(resolveSchema, raw);
  const current = await requireComplaintInScope(scope, id);
  if (current.status !== "ASSIGNED" && current.status !== "IN_PROGRESS") throw new HttpError("INVALID_HOSTEL_COMPLAINT_TRANSITION", `Only an assigned or in-progress complaint can be resolved (this one is "${current.status.toLowerCase()}")`);
  await prisma.$transaction(async (tx) => {
    await tx.hostelComplaint.update({ where: { id }, data: { status: "RESOLVED", resolutionNotes: input.resolutionNotes, resolvedAt: new Date() } });
    await recordAudit(tx, scope, "HOSTEL_COMPLAINT_RESOLVED", "HostelComplaint", id);
  });
  return getHostelComplaint(scope, id);
}

export async function closeHostelComplaint(scope: OrgScope, id: string): Promise<HostelComplaintDto> {
  const current = await requireComplaintInScope(scope, id);
  if (current.status !== "RESOLVED") throw new HttpError("INVALID_HOSTEL_COMPLAINT_TRANSITION", `Only a resolved complaint can be closed (this one is "${current.status.toLowerCase()}")`);
  await prisma.$transaction(async (tx) => {
    await tx.hostelComplaint.update({ where: { id }, data: { status: "CLOSED" } });
    await recordAudit(tx, scope, "HOSTEL_COMPLAINT_STATUS_CHANGED", "HostelComplaint", id, { from: "RESOLVED", to: "CLOSED" });
  });
  return getHostelComplaint(scope, id);
}
