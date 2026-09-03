// Hostel Visitors (Phase C1) — RESIDENT/hostel visitor management, separate
// from the Front Desk Visitor/VisitorVisit domain (different grain: always
// tied to exactly one resident, never a general campus guest). Lifecycle
// EXPECTED -> CHECKED_IN -> CHECKED_OUT, or EXPECTED -> CANCELLED — the same
// 3-transition shape as VisitorVisit. approvedBy*/approvedAt are captured at
// check-in time (admitting the visitor IS the approval).
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { HostelVisitorDto, HostelVisitorStatusDto } from "@/lib/api/contracts";
import { requireActiveResident, studentDisplayName } from "./access";

const STATUS_TO_UI: Record<string, HostelVisitorStatusDto> = { EXPECTED: "expected", CHECKED_IN: "checked_in", CHECKED_OUT: "checked_out", CANCELLED: "cancelled" };
const STATUS_TO_DB: Record<HostelVisitorStatusDto, string> = { expected: "EXPECTED", checked_in: "CHECKED_IN", checked_out: "CHECKED_OUT", cancelled: "CANCELLED" };

const select = {
  id: true, studentId: true, hostelId: true, roomId: true, visitorName: true, relation: true, phone: true, purpose: true,
  expectedAt: true, checkedInAt: true, checkedOutAt: true, status: true, approvedByName: true, approvedAt: true, createdAt: true,
  student: { select: { firstName: true, lastName: true, admissionNumber: true } },
  hostel: { select: { name: true } },
  room: { select: { roomNumber: true } },
} satisfies Prisma.HostelVisitorSelect;

type Row = Prisma.HostelVisitorGetPayload<{ select: typeof select }>;

function dto(r: Row): HostelVisitorDto {
  return {
    id: r.id, studentId: r.studentId, studentName: studentDisplayName(r.student), admissionNumber: r.student.admissionNumber,
    hostelId: r.hostelId, hostelName: r.hostel.name, roomId: r.roomId, roomNumber: r.room.roomNumber,
    visitorName: r.visitorName, relation: r.relation, phone: r.phone, purpose: r.purpose,
    expectedAt: r.expectedAt?.toISOString() ?? null, checkedInAt: r.checkedInAt?.toISOString() ?? null, checkedOutAt: r.checkedOutAt?.toISOString() ?? null,
    status: STATUS_TO_UI[r.status], approvedByName: r.approvedByName, approvedAt: r.approvedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

export const listHostelVisitorsSchema = z.object({
  status: z.enum(["expected", "checked_in", "checked_out", "cancelled"]).optional(),
  studentId: z.string().optional(),
  hostelId: z.string().optional(),
  search: z.string().trim().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
});

export async function listHostelVisitors(scope: OrgScope, raw: unknown): Promise<{ data: HostelVisitorDto[]; meta: { page: number; pageSize: number; total: number; totalPages: number } }> {
  const input = parseInput(listHostelVisitorsSchema, raw);
  const where: Prisma.HostelVisitorWhereInput = {
    schoolId: scope.schoolId,
    ...(scope.branchId ? { branchId: scope.branchId } : {}),
    ...(input.status ? { status: STATUS_TO_DB[input.status] as never } : {}),
    ...(input.studentId ? { studentId: input.studentId } : {}),
    ...(input.hostelId ? { hostelId: input.hostelId } : {}),
    ...(input.search?.trim()
      ? { OR: [{ visitorName: { contains: input.search.trim(), mode: "insensitive" } }, { student: { firstName: { contains: input.search.trim(), mode: "insensitive" } } }, { student: { admissionNumber: { contains: input.search.trim(), mode: "insensitive" } } }] }
      : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.hostelVisitor.count({ where }),
    prisma.hostelVisitor.findMany({ where, select, orderBy: { createdAt: "desc" }, skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
  ]);
  return { data: rows.map(dto), meta: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.max(1, Math.ceil(total / input.pageSize)) } };
}

async function requireVisitorInScope(scope: OrgScope, id: string): Promise<Row> {
  const row = await prisma.hostelVisitor.findFirst({ where: { id, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select });
  if (!row) throw new HttpError("HOSTEL_VISITOR_NOT_FOUND", "Visitor not found");
  return row;
}

export async function getHostelVisitor(scope: OrgScope, id: string): Promise<HostelVisitorDto> {
  return dto(await requireVisitorInScope(scope, id));
}

export const createHostelVisitorSchema = z.object({
  studentId: z.string().min(1),
  visitorName: z.string().trim().min(1).max(120),
  relation: z.string().trim().min(1).max(60),
  phone: z.string().trim().max(30).optional(),
  purpose: z.string().trim().min(1).max(300),
  expectedAt: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?/)).optional(),
});

export async function createHostelVisitor(scope: OrgScope, raw: unknown): Promise<HostelVisitorDto> {
  const input = parseInput(createHostelVisitorSchema, raw);
  const residency = await requireActiveResident(scope, input.studentId);
  const expectedAt = input.expectedAt ? new Date(input.expectedAt) : null;
  if (expectedAt && Number.isNaN(expectedAt.getTime())) throw new HttpError("VALIDATION_ERROR", "Invalid expectedAt date/time");

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.hostelVisitor.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: residency.branchId,
        studentId: input.studentId, hostelId: residency.hostelId, roomId: residency.roomId,
        visitorName: input.visitorName, relation: input.relation, phone: input.phone ?? null, purpose: input.purpose, expectedAt,
        createdByUserId: scope.actor.id, createdByName: scope.actor.name,
      },
      select: { id: true },
    });
    await recordAudit(tx, scope, "HOSTEL_VISITOR_REQUESTED", "HostelVisitor", row.id, { studentId: input.studentId, visitorName: input.visitorName });
    return row.id;
  });
  return getHostelVisitor(scope, created);
}

async function lockVisitor(tx: Prisma.TransactionClient, scope: OrgScope, id: string): Promise<{ id: string; status: string }> {
  const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM hostel_visitors WHERE id = ${id} AND "schoolId" = ${scope.schoolId} FOR UPDATE`;
  if (locked.length === 0) throw new HttpError("HOSTEL_VISITOR_NOT_FOUND", "Visitor not found");
  return tx.hostelVisitor.findUniqueOrThrow({ where: { id }, select: { id: true, status: true } });
}

export async function checkInHostelVisitor(scope: OrgScope, id: string): Promise<HostelVisitorDto> {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const v = await lockVisitor(tx, scope, id);
    if (v.status !== "EXPECTED") throw new HttpError("INVALID_HOSTEL_VISITOR_TRANSITION", `Cannot check in a visitor in "${v.status.toLowerCase()}" status`);
    await tx.hostelVisitor.update({ where: { id }, data: { status: "CHECKED_IN", checkedInAt: now, approvedByUserId: scope.actor.id, approvedByName: scope.actor.name, approvedAt: now } });
    await recordAudit(tx, scope, "HOSTEL_VISITOR_CHECKED_IN", "HostelVisitor", id);
  });
  return getHostelVisitor(scope, id);
}

export async function checkOutHostelVisitor(scope: OrgScope, id: string): Promise<HostelVisitorDto> {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const v = await lockVisitor(tx, scope, id);
    if (v.status !== "CHECKED_IN") throw new HttpError("INVALID_HOSTEL_VISITOR_TRANSITION", `Cannot check out a visitor in "${v.status.toLowerCase()}" status`);
    await tx.hostelVisitor.update({ where: { id }, data: { status: "CHECKED_OUT", checkedOutAt: now } });
    await recordAudit(tx, scope, "HOSTEL_VISITOR_CHECKED_OUT", "HostelVisitor", id);
  });
  return getHostelVisitor(scope, id);
}

export async function cancelHostelVisitor(scope: OrgScope, id: string): Promise<HostelVisitorDto> {
  await prisma.$transaction(async (tx) => {
    const v = await lockVisitor(tx, scope, id);
    if (v.status !== "EXPECTED") throw new HttpError("INVALID_HOSTEL_VISITOR_TRANSITION", `Only an expected visitor can be cancelled (this one is "${v.status.toLowerCase()}")`);
    await tx.hostelVisitor.update({ where: { id }, data: { status: "CANCELLED" } });
    await recordAudit(tx, scope, "HOSTEL_VISITOR_CANCELLED", "HostelVisitor", id);
  });
  return getHostelVisitor(scope, id);
}
