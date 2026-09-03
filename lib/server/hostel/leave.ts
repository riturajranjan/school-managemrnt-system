// Hostel Leave (Phase C1). Server-enforced lifecycle: PENDING -> APPROVED |
// REJECTED | CANCELLED. hostelId/roomId are always the resident's CURRENT
// active StudentHostelAssignment at request time — snapshotted server-side,
// never client-supplied — so a later transfer/vacate never rewrites an
// already-created request.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { HostelLeaveRequestDto, HostelLeaveStatusDto, HostelLeaveTypeDto } from "@/lib/api/contracts";
import { requireActiveResident, studentDisplayName } from "./access";

const LEAVE_TYPE_TO_DB: Record<HostelLeaveTypeDto, string> = { home: "HOME", medical: "MEDICAL", weekend: "WEEKEND", emergency: "EMERGENCY", day_out: "DAY_OUT", other: "OTHER" };
const LEAVE_TYPE_TO_UI: Record<string, HostelLeaveTypeDto> = Object.fromEntries(Object.entries(LEAVE_TYPE_TO_DB).map(([ui, db]) => [db, ui])) as never;
const STATUS_TO_UI: Record<string, HostelLeaveStatusDto> = { PENDING: "pending", APPROVED: "approved", REJECTED: "rejected", CANCELLED: "cancelled" };
const STATUS_TO_DB: Record<HostelLeaveStatusDto, string> = { pending: "PENDING", approved: "APPROVED", rejected: "REJECTED", cancelled: "CANCELLED" };

const select = {
  id: true, studentId: true, hostelId: true, roomId: true, leaveType: true, fromDate: true, toDate: true, reason: true, remarks: true,
  status: true, requestedByUserId: true, requestedAt: true, reviewedByName: true, reviewedAt: true, reviewNote: true, createdAt: true,
  student: { select: { firstName: true, lastName: true, admissionNumber: true } },
  hostel: { select: { name: true } },
  room: { select: { roomNumber: true } },
} satisfies Prisma.HostelLeaveRequestSelect;

type Row = Prisma.HostelLeaveRequestGetPayload<{ select: typeof select }>;

function dto(r: Row): HostelLeaveRequestDto {
  return {
    id: r.id, studentId: r.studentId, studentName: studentDisplayName(r.student), admissionNumber: r.student.admissionNumber,
    hostelId: r.hostelId, hostelName: r.hostel.name, roomId: r.roomId, roomNumber: r.room.roomNumber,
    leaveType: LEAVE_TYPE_TO_UI[r.leaveType], fromDate: r.fromDate.toISOString().slice(0, 10), toDate: r.toDate.toISOString().slice(0, 10),
    reason: r.reason, remarks: r.remarks, status: STATUS_TO_UI[r.status],
    requestedByUserId: r.requestedByUserId, requestedAt: r.requestedAt.toISOString(),
    reviewedByName: r.reviewedByName, reviewedAt: r.reviewedAt?.toISOString() ?? null, reviewNote: r.reviewNote,
    createdAt: r.createdAt.toISOString(),
  };
}

export const listHostelLeaveSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
  studentId: z.string().optional(),
  hostelId: z.string().optional(),
  search: z.string().trim().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
});

export async function listHostelLeaveRequests(scope: OrgScope, raw: unknown): Promise<{ data: HostelLeaveRequestDto[]; meta: { page: number; pageSize: number; total: number; totalPages: number } }> {
  const input = parseInput(listHostelLeaveSchema, raw);
  const where: Prisma.HostelLeaveRequestWhereInput = {
    schoolId: scope.schoolId,
    ...(scope.branchId ? { branchId: scope.branchId } : {}),
    ...(input.status ? { status: STATUS_TO_DB[input.status] as never } : {}),
    ...(input.studentId ? { studentId: input.studentId } : {}),
    ...(input.hostelId ? { hostelId: input.hostelId } : {}),
    ...(input.search?.trim()
      ? { student: { OR: [{ firstName: { contains: input.search.trim(), mode: "insensitive" } }, { lastName: { contains: input.search.trim(), mode: "insensitive" } }, { admissionNumber: { contains: input.search.trim(), mode: "insensitive" } }] } }
      : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.hostelLeaveRequest.count({ where }),
    prisma.hostelLeaveRequest.findMany({ where, select, orderBy: { requestedAt: "desc" }, skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
  ]);
  return { data: rows.map(dto), meta: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.max(1, Math.ceil(total / input.pageSize)) } };
}

async function requireLeaveInScope(scope: OrgScope, id: string): Promise<Row> {
  const row = await prisma.hostelLeaveRequest.findFirst({ where: { id, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select });
  if (!row) throw new HttpError("HOSTEL_LEAVE_NOT_FOUND", "Leave request not found");
  return row;
}

export async function getHostelLeaveRequest(scope: OrgScope, id: string): Promise<HostelLeaveRequestDto> {
  return dto(await requireLeaveInScope(scope, id));
}

export const createHostelLeaveSchema = z.object({
  studentId: z.string().min(1),
  leaveType: z.enum(["home", "medical", "weekend", "emergency", "day_out", "other"]),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().min(1).max(500),
  remarks: z.string().trim().max(500).optional(),
});

export async function createHostelLeaveRequest(scope: OrgScope, raw: unknown): Promise<HostelLeaveRequestDto> {
  const input = parseInput(createHostelLeaveSchema, raw);
  const fromDate = new Date(`${input.fromDate}T00:00:00.000Z`);
  const toDate = new Date(`${input.toDate}T00:00:00.000Z`);
  if (fromDate.getTime() > toDate.getTime()) throw new HttpError("INVALID_HOSTEL_LEAVE_DATES", "The leave start date must be on or before the end date");

  const residency = await requireActiveResident(scope, input.studentId);

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.hostelLeaveRequest.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: residency.branchId,
        studentId: input.studentId, hostelId: residency.hostelId, roomId: residency.roomId,
        leaveType: LEAVE_TYPE_TO_DB[input.leaveType] as never, fromDate, toDate, reason: input.reason, remarks: input.remarks ?? null,
        requestedByUserId: scope.actor.id,
      },
      select: { id: true },
    });
    await recordAudit(tx, scope, "HOSTEL_LEAVE_REQUESTED", "HostelLeaveRequest", row.id, { studentId: input.studentId, leaveType: input.leaveType, fromDate: input.fromDate, toDate: input.toDate });
    return row.id;
  });
  return getHostelLeaveRequest(scope, created);
}

const reviewSchema = z.object({ note: z.string().trim().max(500).optional() });

async function transition(scope: OrgScope, id: string, from: "PENDING", to: "APPROVED" | "REJECTED" | "CANCELLED", action: "HOSTEL_LEAVE_APPROVED" | "HOSTEL_LEAVE_REJECTED" | "HOSTEL_LEAVE_CANCELLED", raw: unknown): Promise<HostelLeaveRequestDto> {
  const input = parseInput(reviewSchema, raw);
  await requireLeaveInScope(scope, id);
  await prisma.$transaction(async (tx) => {
    const updated = await tx.hostelLeaveRequest.updateMany({
      where: { id, status: from },
      data: { status: to, reviewedByUserId: scope.actor.id, reviewedByName: scope.actor.name, reviewedAt: new Date(), reviewNote: input.note ?? null },
    });
    if (updated.count === 0) throw new HttpError("INVALID_HOSTEL_LEAVE_TRANSITION", `Only a pending leave request can be ${to.toLowerCase()}`);
    await recordAudit(tx, scope, action, "HostelLeaveRequest", id, { note: input.note });
  });
  return getHostelLeaveRequest(scope, id);
}

export const approveHostelLeaveRequest = (scope: OrgScope, id: string, raw: unknown) => transition(scope, id, "PENDING", "APPROVED", "HOSTEL_LEAVE_APPROVED", raw);
export const rejectHostelLeaveRequest = (scope: OrgScope, id: string, raw: unknown) => transition(scope, id, "PENDING", "REJECTED", "HOSTEL_LEAVE_REJECTED", raw);
export const cancelHostelLeaveRequest = (scope: OrgScope, id: string, raw: unknown) => transition(scope, id, "PENDING", "CANCELLED", "HOSTEL_LEAVE_CANCELLED", raw);
