// Staff Attendance (Phase 9E.1) — real, PostgreSQL-backed. A SEPARATE domain
// from student AttendanceSession/AttendanceRecord (Phase 5/7C): different
// entity (Staff, not Student), different grain (one row per staff per day, no
// periods/sections). A staff member with no StaffAttendanceRecord for a date
// is NOT_MARKED — never synthesized as ABSENT by a query, and no row is ever
// created just because a page was opened.
//
// ON_LEAVE rows are written by the leave-approval flow (lib/server/leave/
// service.ts) for every date an APPROVED leave covers — LeaveRequest remains
// the leave authority; this table never re-derives leave state on read.
// Marking over an existing ON_LEAVE row requires an explicit `override: true`
// (see markStaffAttendance) so a leave can never be silently clobbered.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { getCurrentStaffProfile } from "@/lib/server/staff/service";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type {
  StaffAttendanceHistoryEntryDto,
  StaffAttendancePercentDto,
  StaffAttendanceRosterEntryDto,
  StaffAttendanceStatusDto,
  StaffAttendanceSummaryDto,
} from "@/lib/api/contracts";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
const timeStr = z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM");
const parseDate = (d: string) => new Date(`${d}T00:00:00.000Z`);
const dateToUi = (d: Date) => d.toISOString().slice(0, 10);
const timeToUi = (d: Date | null) => (d ? d.toISOString().slice(11, 16) : null);
const combineDateTime = (date: string, time: string) => new Date(`${date}T${time}:00.000Z`);

const STATUS_TO_DB: Record<StaffAttendanceStatusDto, string> = { present: "PRESENT", absent: "ABSENT", late: "LATE", "half-day": "HALF_DAY", "on-leave": "ON_LEAVE" };
const statusToUi = (s: string): StaffAttendanceStatusDto => (s === "HALF_DAY" ? "half-day" : s === "ON_LEAVE" ? "on-leave" : (s.toLowerCase() as StaffAttendanceStatusDto));

async function isBroadStaffAttendanceManager(scope: OrgScope): Promise<boolean> {
  const m = await prisma.roleAssignment.findFirst({
    where: { membership: { userId: scope.actor.id, tenantId: scope.tenantId, status: "ACTIVE" }, role: { key: { in: ["SCHOOL_ADMIN", "PRINCIPAL", "HR_ADMIN"] } } },
    select: { id: true },
  });
  return Boolean(m);
}

/** Self-view or roster-view: true if the actor may see this staffId's records. */
async function assertCanViewStaff(scope: OrgScope, staffId: string): Promise<void> {
  const own = await getCurrentStaffProfile(scope);
  if (own?.id === staffId) return;
  if (await isBroadStaffAttendanceManager(scope)) return;
  throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
}

async function requireActiveStaffInScope(scope: OrgScope, staffId: string): Promise<{ id: string }> {
  const s = await prisma.staff.findFirst({ where: { id: staffId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true } });
  if (!s) throw new HttpError("NOT_FOUND", "Staff member not found");
  return s;
}

// ── Roster + summary (a given day, all ACTIVE staff in scope) ──────────────

export const rosterSchema = z.object({ date: dateStr });

export async function getStaffAttendanceRoster(scope: OrgScope, raw: unknown): Promise<StaffAttendanceRosterEntryDto[]> {
  const input = parseInput(rosterSchema, raw);
  const staff = await prisma.staff.findMany({
    where: { schoolId: scope.schoolId, status: "ACTIVE", ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, employeeCode: true, firstName: true, lastName: true, displayName: true, designation: true, department: true },
  });
  const records = await prisma.staffAttendanceRecord.findMany({
    where: { schoolId: scope.schoolId, date: parseDate(input.date), staffId: { in: staff.map((s) => s.id) } },
    select: { id: true, staffId: true, status: true, checkInAt: true, checkOutAt: true, notes: true },
  });
  const byStaff = new Map(records.map((r) => [r.staffId, r]));
  return staff.map((s) => {
    const r = byStaff.get(s.id);
    const name = s.displayName?.trim() || `${s.firstName} ${s.lastName ?? ""}`.trim();
    return {
      staffId: s.id, name, employeeCode: s.employeeCode, designation: s.designation, department: s.department,
      status: r ? statusToUi(r.status) : "not-marked",
      checkInAt: timeToUi(r?.checkInAt ?? null), checkOutAt: timeToUi(r?.checkOutAt ?? null),
      notes: r?.notes ?? null, recordId: r?.id ?? null,
    };
  });
}

export async function getStaffAttendanceSummary(scope: OrgScope, raw: unknown): Promise<StaffAttendanceSummaryDto> {
  const input = parseInput(rosterSchema, raw);
  const totalActiveStaff = await prisma.staff.count({ where: { schoolId: scope.schoolId, status: "ACTIVE", ...(scope.branchId ? { branchId: scope.branchId } : {}) } });
  const grouped = await prisma.staffAttendanceRecord.groupBy({
    by: ["status"],
    where: { schoolId: scope.schoolId, date: parseDate(input.date), ...(scope.branchId ? { branchId: scope.branchId } : {}), staff: { status: "ACTIVE" } },
    _count: { _all: true },
  });
  const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
  const present = counts.PRESENT ?? 0, absent = counts.ABSENT ?? 0, late = counts.LATE ?? 0, halfDay = counts.HALF_DAY ?? 0, onLeave = counts.ON_LEAVE ?? 0;
  const marked = present + absent + late + halfDay + onLeave;
  return { date: input.date, totalActiveStaff, present, absent, late, halfDay, onLeave, notMarked: Math.max(0, totalActiveStaff - marked) };
}

// ── Mark / correct (upsert — one record per staff per day) ─────────────────

export const markStaffAttendanceSchema = z.object({
  date: dateStr,
  entries: z.array(z.object({
    staffId: z.string().min(1),
    status: z.enum(["present", "absent", "late", "half-day", "on-leave"]),
    checkInAt: timeStr.optional(),
    checkOutAt: timeStr.optional(),
    notes: z.string().trim().max(500).optional(),
    override: z.boolean().optional(),
  })).min(1).max(500),
});

export async function markStaffAttendance(scope: OrgScope, raw: unknown): Promise<void> {
  const input = parseInput(markStaffAttendanceSchema, raw);
  const date = parseDate(input.date);
  const staffIds = [...new Set(input.entries.map((e) => e.staffId))];
  const inScope = await prisma.staff.findMany({ where: { id: { in: staffIds }, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true, branchId: true } });
  const branchByStaff = new Map(inScope.map((s) => [s.id, s.branchId]));
  const missing = staffIds.filter((id) => !branchByStaff.has(id));
  if (missing.length > 0) throw new HttpError("NOT_FOUND", "One or more staff members were not found");

  const existing = await prisma.staffAttendanceRecord.findMany({ where: { staffId: { in: staffIds }, date }, select: { staffId: true, status: true } });
  const existingByStaff = new Map(existing.map((r) => [r.staffId, r.status]));
  for (const e of input.entries) {
    const current = existingByStaff.get(e.staffId);
    if (current === "ON_LEAVE" && STATUS_TO_DB[e.status] !== "ON_LEAVE" && !e.override) {
      throw new HttpError("CONFLICT", "Staff member is on approved leave for this date. Pass override to change.");
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const e of input.entries) {
      const row = await tx.staffAttendanceRecord.upsert({
        where: { staffId_date: { staffId: e.staffId, date } },
        create: {
          tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: branchByStaff.get(e.staffId)!,
          staffId: e.staffId, date, status: STATUS_TO_DB[e.status] as never,
          checkInAt: e.checkInAt ? combineDateTime(input.date, e.checkInAt) : null, checkOutAt: e.checkOutAt ? combineDateTime(input.date, e.checkOutAt) : null,
          notes: e.notes ?? null, markedByUserId: scope.actor.id, markedByName: scope.actor.name,
        },
        update: {
          status: STATUS_TO_DB[e.status] as never,
          checkInAt: e.checkInAt === undefined ? undefined : combineDateTime(input.date, e.checkInAt),
          checkOutAt: e.checkOutAt === undefined ? undefined : combineDateTime(input.date, e.checkOutAt),
          notes: e.notes === undefined ? undefined : e.notes, markedByUserId: scope.actor.id, markedByName: scope.actor.name,
        },
        select: { id: true },
      });
      await recordAudit(tx, scope, existingByStaff.has(e.staffId) ? "STAFF_ATTENDANCE_UPDATED" : "STAFF_ATTENDANCE_MARKED", "StaffAttendanceRecord", row.id, { staffId: e.staffId, date: input.date, status: e.status });
    }
  });
}

// ── History + percentage (a staff member, over a date range) ───────────────

const rangeSchema = z.object({ from: dateStr, to: dateStr });

export async function getStaffAttendanceHistory(scope: OrgScope, staffId: string, raw: unknown): Promise<StaffAttendanceHistoryEntryDto[]> {
  await requireActiveStaffInScope(scope, staffId);
  await assertCanViewStaff(scope, staffId);
  const input = parseInput(rangeSchema, raw);
  const rows = await prisma.staffAttendanceRecord.findMany({
    where: { staffId, date: { gte: parseDate(input.from), lte: parseDate(input.to) } },
    orderBy: { date: "desc" },
    select: { id: true, date: true, status: true, checkInAt: true, checkOutAt: true, notes: true, markedByName: true },
  });
  return rows.map((r) => ({ id: r.id, date: dateToUi(r.date), status: statusToUi(r.status), checkInAt: timeToUi(r.checkInAt), checkOutAt: timeToUi(r.checkOutAt), notes: r.notes, markedByName: r.markedByName }));
}

/**
 * Canonical percentage: (PRESENT + LATE + 0.5*HALF_DAY) / countedDays * 100,
 * where countedDays excludes ON_LEAVE (a leave day is neither presence nor
 * absence — it is excluded from the denominator entirely, a deliberate policy
 * documented here since no pre-existing product policy exists). Zero counted
 * days returns `percentage: null`, never a fake 0%.
 */
export async function getStaffAttendancePercent(scope: OrgScope, staffId: string, raw: unknown): Promise<StaffAttendancePercentDto> {
  await requireActiveStaffInScope(scope, staffId);
  await assertCanViewStaff(scope, staffId);
  const input = parseInput(rangeSchema, raw);
  const rows = await prisma.staffAttendanceRecord.findMany({
    where: { staffId, date: { gte: parseDate(input.from), lte: parseDate(input.to) }, status: { not: "ON_LEAVE" } },
    select: { status: true },
  });
  const countedDays = rows.length;
  if (countedDays === 0) return { presentDays: 0, countedDays: 0, percentage: null };
  const weighted = rows.reduce((sum, r) => sum + (r.status === "PRESENT" || r.status === "LATE" ? 1 : r.status === "HALF_DAY" ? 0.5 : 0), 0);
  const presentDays = rows.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
  return { presentDays, countedDays, percentage: Math.round((weighted / countedDays) * 1000) / 10 };
}

/** Internal — used by lib/server/leave/service.ts to write ON_LEAVE rows on approval. Never exported to routes. */
export async function upsertOnLeaveRecord(tx: Prisma.TransactionClient, scope: OrgScope, staffId: string, branchId: string, date: Date): Promise<void> {
  await tx.staffAttendanceRecord.upsert({
    where: { staffId_date: { staffId, date } },
    create: { tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, staffId, date, status: "ON_LEAVE", markedByUserId: scope.actor.id, markedByName: scope.actor.name },
    update: { status: "ON_LEAVE", markedByUserId: scope.actor.id, markedByName: scope.actor.name },
  });
}
