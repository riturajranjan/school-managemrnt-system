// Visitor Visits (Phase 9I) — real, PostgreSQL-backed. Lifecycle:
// EXPECTED -> CHECKED_IN -> CHECKED_OUT, or EXPECTED -> CANCELLED. Exactly
// these 3 transitions exist (see the schema's Phase 9I doc comment for why
// the old mock's WAITING/MEETING/DENIED states were dropped). Every
// transition locks the VisitorVisit row (`SELECT ... FOR UPDATE`) before
// checking status, mirroring lib/server/payroll/runs.ts's finalize lock —
// two concurrent transitions on the same visit can never both succeed.
// checkedInAt/checkedOutAt are always server timestamps, never trusted from
// the client. Host notification reuses the real Phase 9D notification
// engine (Staff.userId only — a Staff with no linked User is silently
// skipped, never a fake recipient).
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { createNotification } from "@/lib/server/notifications/service";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { CreateExpectedVisitRequest, CreateWalkInVisitRequest, VisitorCategoryDto, VisitorDashboardDto, VisitorVisitDetailDto, VisitorVisitListItemDto, VisitorVisitStatusDto } from "@/lib/api/contracts";
import { isBroadVisitorManager, resolveVisitorBranch } from "./access";
import { findOrCreateVisitor } from "./visitors";
import { nextVisitorPassNumber } from "./pass-number";

const CATEGORY_TO_DB: Record<VisitorCategoryDto, string> = {
  parent: "PARENT", vendor: "VENDOR", guest: "GUEST", contractor: "CONTRACTOR",
  interview_candidate: "INTERVIEW_CANDIDATE", alumni: "ALUMNI", official: "OFFICIAL", other: "OTHER",
};
const CATEGORY_TO_UI: Record<string, VisitorCategoryDto> = Object.fromEntries(Object.entries(CATEGORY_TO_DB).map(([ui, db]) => [db, ui])) as never;
const STATUS_TO_UI: Record<string, VisitorVisitStatusDto> = { EXPECTED: "expected", CHECKED_IN: "checked_in", CHECKED_OUT: "checked_out", CANCELLED: "cancelled" };
const STATUS_TO_DB: Record<VisitorVisitStatusDto, string> = { expected: "EXPECTED", checked_in: "CHECKED_IN", checked_out: "CHECKED_OUT", cancelled: "CANCELLED" };

function displayName(s: { firstName: string; lastName: string | null; displayName: string | null }) {
  return s.displayName ?? [s.firstName, s.lastName].filter(Boolean).join(" ");
}

const listSelect = {
  id: true, visitorId: true, hostStaffId: true, category: true, purpose: true, department: true, vehicleNumber: true,
  status: true, expectedAt: true, checkedInAt: true, checkedOutAt: true, passNumber: true,
  visitor: { select: { fullName: true, phone: true, organization: true } },
  host: { select: { firstName: true, lastName: true, displayName: true } },
} satisfies Prisma.VisitorVisitSelect;

function listDto(v: Prisma.VisitorVisitGetPayload<{ select: typeof listSelect }>): VisitorVisitListItemDto {
  return {
    id: v.id, visitorId: v.visitorId, visitorName: v.visitor.fullName, visitorPhone: v.visitor.phone, organization: v.visitor.organization,
    hostStaffId: v.hostStaffId, hostName: displayName(v.host), category: CATEGORY_TO_UI[v.category], purpose: v.purpose,
    department: v.department, vehicleNumber: v.vehicleNumber, status: STATUS_TO_UI[v.status],
    expectedAt: v.expectedAt?.toISOString() ?? null, checkedInAt: v.checkedInAt?.toISOString() ?? null, checkedOutAt: v.checkedOutAt?.toISOString() ?? null,
    passNumber: v.passNumber,
  };
}

async function requireActiveHostInScope(scope: OrgScope, hostStaffId: string): Promise<void> {
  const staff = await prisma.staff.findFirst({ where: { id: hostStaffId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (!staff) throw new HttpError("INVALID_HOST", "Host must be a real, active staff member in this school");
}

async function notifyHostCheckedIn(tx: Prisma.TransactionClient, scope: OrgScope, visitId: string, visitorName: string, hostStaffId: string): Promise<void> {
  const host = await tx.staff.findUnique({ where: { id: hostStaffId }, select: { userId: true } });
  if (!host?.userId) return; // Staff with no linked User account — never a fake recipient
  await createNotification(tx, {
    tenantId: scope.tenantId, schoolId: scope.schoolId, type: "VISITOR_CHECKED_IN",
    title: "Visitor checked in", body: `${visitorName} has checked in to meet you.`, href: "/front-desk/visitors",
    sourceType: "VisitorVisit", sourceId: visitId, dedupeKey: `VISITOR_CHECKED_IN:${visitId}`, recipientUserIds: [host.userId],
  });
}

export const listVisitsSchema = z.object({
  status: z.enum(["expected", "checked_in", "checked_out", "cancelled"]).optional(),
  hostStaffId: z.string().optional(),
  search: z.string().trim().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
});

export async function listVisits(scope: OrgScope, raw: unknown): Promise<{ data: VisitorVisitListItemDto[]; meta: { page: number; pageSize: number; total: number; totalPages: number } }> {
  const input = parseInput(listVisitsSchema, raw);
  const dayFilter = input.date ? { gte: new Date(`${input.date}T00:00:00.000Z`), lt: new Date(`${input.date}T23:59:59.999Z`) } : undefined;

  const where: Prisma.VisitorVisitWhereInput = {
    schoolId: scope.schoolId,
    ...(scope.branchId ? { branchId: scope.branchId } : {}),
    ...(input.status ? { status: STATUS_TO_DB[input.status] as never } : {}),
    ...(input.hostStaffId ? { hostStaffId: input.hostStaffId } : {}),
    ...(dayFilter ? { OR: [{ expectedAt: dayFilter }, { checkedInAt: dayFilter }, { createdAt: dayFilter }] } : {}),
    ...(input.search?.trim() ? { visitor: { OR: [{ fullName: { contains: input.search.trim(), mode: "insensitive" } }, { phone: { contains: input.search.trim() } }] } } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.visitorVisit.count({ where }),
    prisma.visitorVisit.findMany({ where, orderBy: [{ createdAt: "desc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize, select: listSelect }),
  ]);
  return { data: rows.map(listDto), meta: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.max(1, Math.ceil(total / input.pageSize)) } };
}

async function requireVisitInScope(scope: OrgScope, visitId: string) {
  const row = await prisma.visitorVisit.findFirst({ where: { id: visitId, schoolId: scope.schoolId }, select: listSelect });
  if (!row) throw new HttpError("VISIT_NOT_FOUND", "Visit not found");
  return row;
}

export async function getVisit(scope: OrgScope, visitId: string): Promise<VisitorVisitDetailDto> {
  const row = await requireVisitInScope(scope, visitId);
  const visitorPastVisitCount = await prisma.visitorVisit.count({ where: { visitorId: row.visitorId, id: { not: visitId } } });
  return { ...listDto(row), visitorPastVisitCount };
}

const walkInSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(1).max(30),
  organization: z.string().trim().max(120).optional(),
  category: z.enum(["parent", "vendor", "guest", "contractor", "interview_candidate", "alumni", "official", "other"]),
  purpose: z.string().trim().min(1).max(300),
  department: z.string().trim().max(80).optional(),
  vehicleNumber: z.string().trim().max(30).optional(),
  hostStaffId: z.string().min(1),
});

export async function createWalkInVisit(scope: OrgScope, raw: unknown): Promise<VisitorVisitDetailDto> {
  if (!(await isBroadVisitorManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input: CreateWalkInVisitRequest = parseInput(walkInSchema, raw);
  await requireActiveHostInScope(scope, input.hostStaffId);
  const branchId = await resolveVisitorBranch(scope);
  const school = await prisma.school.findUniqueOrThrow({ where: { id: scope.schoolId }, select: { code: true } });
  const now = new Date();

  const created = await prisma.$transaction(async (tx) => {
    const visitorId = await findOrCreateVisitor(tx, scope, input);
    const passNumber = await nextVisitorPassNumber(tx, scope.schoolId, school.code, now.getUTCFullYear());
    const visit = await tx.visitorVisit.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, visitorId, hostStaffId: input.hostStaffId,
        category: CATEGORY_TO_DB[input.category] as never, purpose: input.purpose, department: input.department ?? null, vehicleNumber: input.vehicleNumber ?? null,
        status: "CHECKED_IN", checkedInAt: now, passNumber,
        createdByUserId: scope.actor.id, createdByName: scope.actor.name,
      },
      select: { id: true },
    });
    await recordAudit(tx, scope, "VISITOR_CHECKED_IN", "VisitorVisit", visit.id, { passNumber });
    await notifyHostCheckedIn(tx, scope, visit.id, input.fullName, input.hostStaffId);
    return visit;
  });
  return getVisit(scope, created.id);
}

const expectedSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(1).max(30),
  organization: z.string().trim().max(120).optional(),
  category: z.enum(["parent", "vendor", "guest", "contractor", "interview_candidate", "alumni", "official", "other"]),
  purpose: z.string().trim().min(1).max(300),
  department: z.string().trim().max(80).optional(),
  hostStaffId: z.string().min(1),
  expectedAt: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?/)),
});

export async function createExpectedVisit(scope: OrgScope, raw: unknown): Promise<VisitorVisitDetailDto> {
  if (!(await isBroadVisitorManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input: CreateExpectedVisitRequest = parseInput(expectedSchema, raw);
  await requireActiveHostInScope(scope, input.hostStaffId);
  const branchId = await resolveVisitorBranch(scope);
  const expectedAt = new Date(input.expectedAt);
  if (Number.isNaN(expectedAt.getTime())) throw new HttpError("VALIDATION_ERROR", "Invalid expectedAt date/time");

  const created = await prisma.$transaction(async (tx) => {
    const visitorId = await findOrCreateVisitor(tx, scope, input);
    const visit = await tx.visitorVisit.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, visitorId, hostStaffId: input.hostStaffId,
        category: CATEGORY_TO_DB[input.category] as never, purpose: input.purpose, department: input.department ?? null,
        status: "EXPECTED", expectedAt,
        createdByUserId: scope.actor.id, createdByName: scope.actor.name,
      },
      select: { id: true },
    });
    await recordAudit(tx, scope, "VISIT_EXPECTED", "VisitorVisit", visit.id, { expectedAt: expectedAt.toISOString() });
    return visit;
  });
  return getVisit(scope, created.id);
}

async function lockVisit(tx: Prisma.TransactionClient, scope: OrgScope, visitId: string): Promise<{ id: string; status: string; visitorId: string; hostStaffId: string }> {
  const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM visitor_visits WHERE id = ${visitId} AND "schoolId" = ${scope.schoolId} FOR UPDATE`;
  if (locked.length === 0) throw new HttpError("VISIT_NOT_FOUND", "Visit not found");
  const row = await tx.visitorVisit.findUniqueOrThrow({ where: { id: visitId }, select: { id: true, status: true, visitorId: true, hostStaffId: true } });
  return row;
}

export async function checkInVisit(scope: OrgScope, visitId: string): Promise<VisitorVisitDetailDto> {
  if (!(await isBroadVisitorManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const school = await prisma.school.findUniqueOrThrow({ where: { id: scope.schoolId }, select: { code: true } });
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const visit = await lockVisit(tx, scope, visitId);
    if (visit.status !== "EXPECTED") throw new HttpError("INVALID_VISIT_TRANSITION", `Cannot check in a visit in "${visit.status.toLowerCase()}" status`);
    const passNumber = await nextVisitorPassNumber(tx, scope.schoolId, school.code, now.getUTCFullYear());
    await tx.visitorVisit.update({ where: { id: visitId }, data: { status: "CHECKED_IN", checkedInAt: now, passNumber } });
    await recordAudit(tx, scope, "VISITOR_CHECKED_IN", "VisitorVisit", visitId, { passNumber });
    const visitorRow = await tx.visitor.findUniqueOrThrow({ where: { id: visit.visitorId }, select: { fullName: true } });
    await notifyHostCheckedIn(tx, scope, visitId, visitorRow.fullName, visit.hostStaffId);
  });
  return getVisit(scope, visitId);
}

export async function checkOutVisit(scope: OrgScope, visitId: string): Promise<VisitorVisitDetailDto> {
  if (!(await isBroadVisitorManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const visit = await lockVisit(tx, scope, visitId);
    if (visit.status === "CHECKED_OUT") throw new HttpError("VISIT_ALREADY_CHECKED_OUT", "This visit has already been checked out");
    if (visit.status !== "CHECKED_IN") throw new HttpError("INVALID_VISIT_TRANSITION", `Cannot check out a visit in "${visit.status.toLowerCase()}" status`);
    await tx.visitorVisit.update({ where: { id: visitId }, data: { status: "CHECKED_OUT", checkedOutAt: now } });
    await recordAudit(tx, scope, "VISITOR_CHECKED_OUT", "VisitorVisit", visitId);
  });
  return getVisit(scope, visitId);
}

export async function cancelVisit(scope: OrgScope, visitId: string): Promise<VisitorVisitDetailDto> {
  if (!(await isBroadVisitorManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  await prisma.$transaction(async (tx) => {
    const visit = await lockVisit(tx, scope, visitId);
    if (visit.status !== "EXPECTED") throw new HttpError("INVALID_VISIT_TRANSITION", `Only an expected visit can be cancelled (this one is "${visit.status.toLowerCase()}")`);
    await tx.visitorVisit.update({ where: { id: visitId }, data: { status: "CANCELLED" } });
    await recordAudit(tx, scope, "VISIT_CANCELLED", "VisitorVisit", visitId);
  });
  return getVisit(scope, visitId);
}

export async function getVisitorDashboard(scope: OrgScope): Promise<VisitorDashboardDto> {
  const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setUTCHours(23, 59, 59, 999);
  const where = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };

  const [today, currentlyInsideList, expectedToday, checkedOutToday] = await Promise.all([
    prisma.visitorVisit.count({ where: { ...where, OR: [{ checkedInAt: { gte: todayStart, lte: todayEnd } }, { expectedAt: { gte: todayStart, lte: todayEnd } }] } }),
    prisma.visitorVisit.findMany({ where: { ...where, status: "CHECKED_IN" }, orderBy: { checkedInAt: "desc" }, select: listSelect }),
    prisma.visitorVisit.count({ where: { ...where, status: "EXPECTED", expectedAt: { gte: todayStart, lte: todayEnd } } }),
    prisma.visitorVisit.count({ where: { ...where, status: "CHECKED_OUT", checkedOutAt: { gte: todayStart, lte: todayEnd } } }),
  ]);

  return { today, currentlyInside: currentlyInsideList.length, expectedToday, checkedOutToday, currentlyInsideList: currentlyInsideList.map(listDto) };
}
