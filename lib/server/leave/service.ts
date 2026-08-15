// Leave Management (Phase 9E.2) — real, PostgreSQL-backed. LeaveRequest is the
// SOLE authority for staff leave. Approving a request writes ON_LEAVE onto
// StaffAttendanceRecord (lib/server/staff-attendance/service.ts) for every
// date it covers — a deliberate one-way write documented on the schema; leave
// state is never re-derived from attendance, and attendance never duplicates
// a leave request's own fields (reason, reviewer, etc).
//
// OWNERSHIP: self-service — a request's staffId resolves from the actor's own
// real Staff profile (User -> Staff.userId), never trusted from the client.
// A broad manager (SCHOOL_ADMIN/PRINCIPAL/HR_ADMIN) may record leave on behalf
// of another real Staff member by supplying staffId explicitly (matches the
// existing "Record leave" admin affordance) and reviews/approves/rejects any
// request. LEAVE BALANCES are explicitly DEFERRED (see listLeaveTypes doc) —
// no allocation/accrual/entitlement model exists in the current product, and
// inventing one silently was ruled out.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { createNotification } from "@/lib/server/notifications/service";
import { parseInput } from "@/lib/server/validation";
import { getCurrentStaffProfile } from "@/lib/server/staff/service";
import { upsertOnLeaveRecord } from "@/lib/server/staff-attendance/service";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { LeaveRequestDto, LeaveRequestStatusDto, LeaveTypeDto } from "@/lib/api/contracts";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
const parseDate = (d: string) => new Date(`${d}T00:00:00.000Z`);
const dateToUi = (d: Date) => d.toISOString().slice(0, 10);
const REVIEWER_ROLE_KEYS = ["SCHOOL_ADMIN", "PRINCIPAL", "HR_ADMIN"];

async function isBroadLeaveManager(scope: OrgScope): Promise<boolean> {
  const m = await prisma.roleAssignment.findFirst({
    where: { membership: { userId: scope.actor.id, tenantId: scope.tenantId, status: "ACTIVE" }, role: { key: { in: REVIEWER_ROLE_KEYS } } },
    select: { id: true },
  });
  return Boolean(m);
}

async function resolveReviewerUserIds(scope: OrgScope): Promise<string[]> {
  const staffWithUser = await prisma.staff.findMany({ where: { schoolId: scope.schoolId, status: "ACTIVE", userId: { not: null } }, select: { userId: true } });
  const userIds = [...new Set(staffWithUser.map((s) => s.userId).filter((id): id is string => Boolean(id)))];
  if (userIds.length === 0) return [];
  const rows = await prisma.roleAssignment.findMany({
    where: { membership: { userId: { in: userIds }, tenantId: scope.tenantId, status: "ACTIVE" }, role: { key: { in: REVIEWER_ROLE_KEYS } } },
    select: { membership: { select: { userId: true } } },
  });
  return [...new Set(rows.map((r) => r.membership.userId))];
}

// ── Leave types ──────────────────────────────────────────────────────────

export async function listLeaveTypes(scope: OrgScope, includeInactive = false): Promise<LeaveTypeDto[]> {
  const rows = await prisma.leaveType.findMany({
    where: { schoolId: scope.schoolId, ...(includeInactive ? {} : { status: "ACTIVE" }) },
    orderBy: { name: "asc" },
  });
  return rows.map((t) => ({ id: t.id, name: t.name, code: t.code, description: t.description, isPaid: t.isPaid, status: t.status === "ACTIVE" ? "active" : "inactive" }));
}

export const createLeaveTypeSchema = z.object({ name: z.string().trim().min(1).max(80), code: z.string().trim().min(1).max(20), description: z.string().trim().max(500).optional(), isPaid: z.boolean().default(true) });

export async function createLeaveType(scope: OrgScope, raw: unknown): Promise<LeaveTypeDto> {
  if (!(await isBroadLeaveManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(createLeaveTypeSchema, raw);
  const clash = await prisma.leaveType.findFirst({ where: { schoolId: scope.schoolId, code: { equals: input.code, mode: "insensitive" } }, select: { id: true } });
  if (clash) throw new HttpError("LEAVE_TYPE_CODE_EXISTS", "A leave type with this code already exists");
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.leaveType.create({ data: { tenantId: scope.tenantId, schoolId: scope.schoolId, name: input.name, code: input.code, description: input.description ?? null, isPaid: input.isPaid } });
    await recordAudit(tx, scope, "LEAVE_TYPE_CREATED", "LeaveType", row.id, { name: row.name });
    return row;
  });
  return { id: created.id, name: created.name, code: created.code, description: created.description, isPaid: created.isPaid, status: "active" };
}

export const updateLeaveTypeSchema = z.object({ name: z.string().trim().min(1).max(80).optional(), description: z.string().trim().max(500).optional(), isPaid: z.boolean().optional(), status: z.enum(["active", "inactive"]).optional() });

export async function updateLeaveType(scope: OrgScope, leaveTypeId: string, raw: unknown): Promise<LeaveTypeDto> {
  if (!(await isBroadLeaveManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(updateLeaveTypeSchema, raw);
  const existing = await prisma.leaveType.findFirst({ where: { id: leaveTypeId, schoolId: scope.schoolId }, select: { id: true } });
  if (!existing) throw new HttpError("LEAVE_TYPE_NOT_FOUND", "Leave type not found");
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.leaveType.update({ where: { id: leaveTypeId }, data: { name: input.name, description: input.description, isPaid: input.isPaid, status: input.status ? (input.status === "active" ? "ACTIVE" : "INACTIVE") : undefined } });
    await recordAudit(tx, scope, "LEAVE_TYPE_UPDATED", "LeaveType", leaveTypeId);
    return row;
  });
  return { id: updated.id, name: updated.name, code: updated.code, description: updated.description, isPaid: updated.isPaid, status: updated.status === "ACTIVE" ? "active" : "inactive" };
}

// ── Requests ─────────────────────────────────────────────────────────────

const displayName = (s: { displayName: string | null; firstName: string; lastName: string | null }) => s.displayName?.trim() || `${s.firstName} ${s.lastName ?? ""}`.trim();
const STATUS_TO_UI: Record<string, LeaveRequestStatusDto> = { PENDING: "pending", APPROVED: "approved", REJECTED: "rejected", CANCELLED: "cancelled" };
const STATUS_TO_UI_INVERSE: Record<string, string> = { pending: "PENDING", approved: "APPROVED", rejected: "REJECTED", cancelled: "CANCELLED" };

type LeaveRequestRow = {
  id: string; staffId: string; leaveTypeId: string; startDate: Date; endDate: Date; halfDay: boolean; reason: string; status: string;
  requestedAt: Date; reviewedByName: string | null; reviewedAt: Date | null; reviewNote: string | null;
  staff: { firstName: string; lastName: string | null; displayName: string | null }; leaveType: { name: string };
};
function toDto(r: LeaveRequestRow): LeaveRequestDto {
  return {
    id: r.id, staffId: r.staffId, staffName: displayName(r.staff), leaveTypeId: r.leaveTypeId, leaveTypeName: r.leaveType.name,
    startDate: dateToUi(r.startDate), endDate: dateToUi(r.endDate), halfDay: r.halfDay, reason: r.reason, status: STATUS_TO_UI[r.status] ?? "pending",
    requestedAt: r.requestedAt.toISOString(), reviewedByName: r.reviewedByName, reviewedAt: r.reviewedAt?.toISOString() ?? null, reviewNote: r.reviewNote,
  };
}
const requestSelect = {
  id: true, staffId: true, leaveTypeId: true, startDate: true, endDate: true, halfDay: true, reason: true, status: true,
  requestedAt: true, reviewedByName: true, reviewedAt: true, reviewNote: true,
  staff: { select: { firstName: true, lastName: true, displayName: true } }, leaveType: { select: { name: true } },
} satisfies Prisma.LeaveRequestSelect;

export const listLeaveRequestsSchema = z.object({ staffId: z.string().optional(), status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional() });

export async function listLeaveRequests(scope: OrgScope, raw: unknown): Promise<LeaveRequestDto[]> {
  const input = parseInput(listLeaveRequestsSchema, raw);
  const broadManager = await isBroadLeaveManager(scope);
  const where: Prisma.LeaveRequestWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (input.status) where.status = STATUS_TO_UI_INVERSE[input.status] as never;

  if (broadManager) {
    if (input.staffId) where.staffId = input.staffId;
  } else {
    const own = await getCurrentStaffProfile(scope);
    if (!own) return [];
    where.staffId = own.id;
  }
  const rows = await prisma.leaveRequest.findMany({ where, orderBy: { requestedAt: "desc" }, select: requestSelect });
  return rows.map(toDto);
}

async function requireRequestInScope(scope: OrgScope, leaveRequestId: string): Promise<LeaveRequestRow> {
  const row = await prisma.leaveRequest.findFirst({ where: { id: leaveRequestId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: requestSelect });
  if (!row) throw new HttpError("LEAVE_REQUEST_NOT_FOUND", "Leave request not found");
  return row;
}

export async function getLeaveRequest(scope: OrgScope, leaveRequestId: string): Promise<LeaveRequestDto> {
  const row = await requireRequestInScope(scope, leaveRequestId);
  const broadManager = await isBroadLeaveManager(scope);
  if (!broadManager) {
    const own = await getCurrentStaffProfile(scope);
    if (own?.id !== row.staffId) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  }
  return toDto(row);
}

export const createLeaveRequestSchema = z.object({
  staffId: z.string().min(1).optional(),
  leaveTypeId: z.string().min(1),
  startDate: dateStr,
  endDate: dateStr,
  halfDay: z.boolean().default(false),
  reason: z.string().trim().min(1).max(1000),
});

export async function createLeaveRequest(scope: OrgScope, raw: unknown): Promise<LeaveRequestDto> {
  const input = parseInput(createLeaveRequestSchema, raw);
  const broadManager = await isBroadLeaveManager(scope);

  let staffId: string;
  if (input.staffId && broadManager) {
    staffId = input.staffId;
  } else {
    const own = await getCurrentStaffProfile(scope);
    if (!own) throw new HttpError("VALIDATION_ERROR", "No staff profile is linked to your account");
    staffId = own.id;
  }
  const staff = await prisma.staff.findFirst({ where: { id: staffId, schoolId: scope.schoolId, status: "ACTIVE", ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true, branchId: true } });
  if (!staff) throw new HttpError("NOT_FOUND", "Staff member not found");

  const leaveType = await prisma.leaveType.findFirst({ where: { id: input.leaveTypeId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (!leaveType) throw new HttpError("LEAVE_TYPE_NOT_FOUND", "Leave type not found");

  const startDate = parseDate(input.startDate), endDate = parseDate(input.endDate);
  if (startDate > endDate) throw new HttpError("INVALID_LEAVE_DATES", "`startDate` must not be after `endDate`");

  const created = await prisma.$transaction(async (tx) => {
    // Row-lock the staff record so two concurrent submissions for the same
    // staff member can never both pass the overlap check.
    await tx.$queryRaw`SELECT id FROM staff WHERE id = ${staffId} FOR UPDATE`;
    const overlap = await tx.leaveRequest.findFirst({
      where: { staffId, status: { in: ["PENDING", "APPROVED"] }, startDate: { lte: endDate }, endDate: { gte: startDate } },
      select: { id: true },
    });
    if (overlap) throw new HttpError("LEAVE_OVERLAP", "This staff member already has a pending or approved leave request overlapping these dates");

    const row = await tx.leaveRequest.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: staff.branchId, staffId, leaveTypeId: input.leaveTypeId,
        startDate, endDate, halfDay: input.halfDay, reason: input.reason, requestedByUserId: scope.actor.id,
      },
      select: requestSelect,
    });
    await recordAudit(tx, scope, "LEAVE_REQUEST_CREATED", "LeaveRequest", row.id, { staffId, startDate: input.startDate, endDate: input.endDate });

    const reviewerUserIds = await resolveReviewerUserIds(scope);
    await createNotification(tx, {
      tenantId: scope.tenantId, schoolId: scope.schoolId, type: "LEAVE_REQUEST_SUBMITTED",
      title: `Leave request from ${displayName(row.staff)}`, body: `${displayName(row.staff)} requested ${row.leaveType.name} from ${input.startDate} to ${input.endDate}.`,
      href: "/attendance/leave", sourceType: "LeaveRequest", sourceId: row.id, dedupeKey: `LEAVE_REQUEST_SUBMITTED:${row.id}`, recipientUserIds: reviewerUserIds,
    });
    return row;
  });
  return toDto(created);
}

async function notifyLeaveReview(tx: Prisma.TransactionClient, scope: OrgScope, row: LeaveRequestRow, type: "LEAVE_REQUEST_APPROVED" | "LEAVE_REQUEST_REJECTED", note: string | null): Promise<void> {
  const staff = await tx.staff.findUnique({ where: { id: row.staffId }, select: { userId: true } });
  await createNotification(tx, {
    tenantId: scope.tenantId, schoolId: scope.schoolId, type,
    title: type === "LEAVE_REQUEST_APPROVED" ? "Leave request approved" : "Leave request rejected",
    body: type === "LEAVE_REQUEST_APPROVED" ? `Your ${row.leaveType.name} request (${dateToUi(row.startDate)} – ${dateToUi(row.endDate)}) was approved.` : `Your ${row.leaveType.name} request (${dateToUi(row.startDate)} – ${dateToUi(row.endDate)}) was rejected.${note ? ` Reason: ${note}` : ""}`,
    href: "/attendance/leave", sourceType: "LeaveRequest", sourceId: row.id, dedupeKey: `${type}:${row.id}`, recipientUserIds: staff?.userId ? [staff.userId] : [],
  });
}

/** All UTC-day dates in [start, end] inclusive. Capped at 366 — a leave request can never hang the query. */
function daysInRange(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  let cursor = new Date(start);
  let guard = 0;
  while (cursor <= end && guard < 366) {
    out.push(new Date(cursor));
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() + 1));
    guard += 1;
  }
  return out;
}

export async function approveLeaveRequest(scope: OrgScope, leaveRequestId: string): Promise<LeaveRequestDto> {
  if (!(await isBroadLeaveManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const existing = await requireRequestInScope(scope, leaveRequestId);
  const staff = await prisma.staff.findUniqueOrThrow({ where: { id: existing.staffId }, select: { branchId: true } });

  const { count } = await prisma.$transaction(async (tx) => {
    const result = await tx.leaveRequest.updateMany({
      where: { id: leaveRequestId, status: "PENDING" },
      data: { status: "APPROVED", reviewedByUserId: scope.actor.id, reviewedByName: scope.actor.name, reviewedAt: new Date(), reviewNote: null },
    });
    if (result.count > 0) {
      await recordAudit(tx, scope, "LEAVE_REQUEST_APPROVED", "LeaveRequest", leaveRequestId, {});
      for (const day of daysInRange(existing.startDate, existing.endDate)) {
        await upsertOnLeaveRecord(tx, scope, existing.staffId, staff.branchId, day);
      }
      await notifyLeaveReview(tx, scope, existing, "LEAVE_REQUEST_APPROVED", null);
    }
    return result;
  });
  if (count === 0) throw new HttpError("CONFLICT", "Only a pending request can be approved");
  return getLeaveRequest(scope, leaveRequestId);
}

export const rejectLeaveRequestSchema = z.object({ reviewNote: z.string().trim().min(1).max(500) });

export async function rejectLeaveRequest(scope: OrgScope, leaveRequestId: string, raw: unknown): Promise<LeaveRequestDto> {
  if (!(await isBroadLeaveManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(rejectLeaveRequestSchema, raw);
  const existing = await requireRequestInScope(scope, leaveRequestId);

  const { count } = await prisma.$transaction(async (tx) => {
    const result = await tx.leaveRequest.updateMany({
      where: { id: leaveRequestId, status: "PENDING" },
      data: { status: "REJECTED", reviewedByUserId: scope.actor.id, reviewedByName: scope.actor.name, reviewedAt: new Date(), reviewNote: input.reviewNote },
    });
    if (result.count > 0) {
      await recordAudit(tx, scope, "LEAVE_REQUEST_REJECTED", "LeaveRequest", leaveRequestId, { reviewNote: input.reviewNote });
      await notifyLeaveReview(tx, scope, existing, "LEAVE_REQUEST_REJECTED", input.reviewNote);
    }
    return result;
  });
  if (count === 0) throw new HttpError("CONFLICT", "Only a pending request can be rejected");
  return getLeaveRequest(scope, leaveRequestId);
}

export async function cancelLeaveRequest(scope: OrgScope, leaveRequestId: string): Promise<LeaveRequestDto> {
  const existing = await requireRequestInScope(scope, leaveRequestId);
  const broadManager = await isBroadLeaveManager(scope);
  if (!broadManager) {
    const own = await getCurrentStaffProfile(scope);
    if (own?.id !== existing.staffId) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  }
  const { count } = await prisma.$transaction(async (tx) => {
    const result = await tx.leaveRequest.updateMany({ where: { id: leaveRequestId, status: "PENDING" }, data: { status: "CANCELLED" } });
    if (result.count > 0) await recordAudit(tx, scope, "LEAVE_REQUEST_CANCELLED", "LeaveRequest", leaveRequestId, {});
    return result;
  });
  if (count === 0) throw new HttpError("CONFLICT", "Only a pending request can be cancelled");
  return getLeaveRequest(scope, leaveRequestId);
}
