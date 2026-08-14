// Timetable — bell/period structure service (Phase 7). Real, PostgreSQL-backed.
// A TimetablePeriod is one column of the school day (branch + session scoped).
// Times are stored as MINUTES FROM MIDNIGHT (deterministic, timezone-free) and
// surfaced as HH:mm. The whole bell schedule is edited atomically (PUT reconcile):
// every period is validated (start<end, no overlaps, unique period numbers) before
// any write. Routes enforce timetable.view / timetable.manage.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { PeriodType, TimetablePeriodDto } from "@/lib/api/contracts";

const PTYPE_TO_DB: Record<PeriodType, string> = { teaching: "TEACHING", break: "BREAK" };
const ptypeToUi = (t: string): PeriodType => t.toLowerCase() as PeriodType;

/** "HH:mm" → minutes from midnight (0..1439). */
export function hhmmToMinutes(s: string): number {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s);
  if (!m) throw new HttpError("INVALID_TIMETABLE_PERIOD", `Invalid time "${s}" (expected HH:mm)`);
  return Number(m[1]) * 60 + Number(m[2]);
}
export const minutesToHhmm = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function requireSession(scope: OrgScope): string {
  if (!scope.academicSessionId) throw new HttpError("INVALID_SESSION", "Select an academic session first");
  return scope.academicSessionId;
}
function requireBranch(scope: OrgScope): string {
  if (!scope.branchId) throw new HttpError("INVALID_BRANCH", "Select a branch first");
  return scope.branchId;
}

const periodInput = z.object({
  name: z.string().trim().min(1).max(40),
  periodNumber: z.number().int().min(1).max(50),
  startTime: z.string(),
  endTime: z.string(),
  type: z.enum(["teaching", "break"]).default("teaching"),
});
export const reconcilePeriodsSchema = z.object({ periods: z.array(periodInput).max(50) });

type PeriodRow = { id: string; name: string; periodNumber: number; startMinutes: number; endMinutes: number; type: string; order: number };
function periodDto(p: PeriodRow): TimetablePeriodDto {
  return {
    id: p.id, name: p.name, periodNumber: p.periodNumber,
    startTime: minutesToHhmm(p.startMinutes), endTime: minutesToHhmm(p.endMinutes),
    startMinutes: p.startMinutes, endMinutes: p.endMinutes, type: ptypeToUi(p.type), order: p.order,
  };
}
const periodSelect = { id: true, name: true, periodNumber: true, startMinutes: true, endMinutes: true, type: true, order: true };

export async function listPeriods(scope: OrgScope): Promise<TimetablePeriodDto[]> {
  const rows = await prisma.timetablePeriod.findMany({
    where: { schoolId: scope.schoolId, branchId: requireBranch(scope), academicSessionId: requireSession(scope) },
    orderBy: [{ order: "asc" }, { periodNumber: "asc" }],
    select: periodSelect,
  });
  return rows.map(periodDto);
}

/** Atomically replace the branch/session bell schedule. Validates all periods first. */
export async function reconcilePeriods(scope: OrgScope, raw: unknown): Promise<TimetablePeriodDto[]> {
  const { periods } = parseInput(reconcilePeriodsSchema, raw);
  const branchId = requireBranch(scope);
  const academicSessionId = requireSession(scope);

  // Validate: each start<end; unique period numbers; no overlaps (sorted by start).
  const prepared = periods.map((p, i) => {
    const startMinutes = hhmmToMinutes(p.startTime);
    const endMinutes = hhmmToMinutes(p.endTime);
    if (startMinutes >= endMinutes) throw new HttpError("INVALID_TIMETABLE_PERIOD", `Period "${p.name}" must start before it ends`);
    return { ...p, startMinutes, endMinutes, order: i };
  });
  const numbers = new Set<number>();
  for (const p of prepared) {
    if (numbers.has(p.periodNumber)) throw new HttpError("INVALID_TIMETABLE_PERIOD", `Duplicate period number ${p.periodNumber}`);
    numbers.add(p.periodNumber);
  }
  const sorted = [...prepared].sort((a, b) => a.startMinutes - b.startMinutes);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startMinutes < sorted[i - 1].endMinutes) {
      throw new HttpError("INVALID_TIMETABLE_PERIOD", `Periods "${sorted[i - 1].name}" and "${sorted[i].name}" overlap`);
    }
  }

  await prisma.$transaction(async (tx) => {
    // Deleting a period cascades its entries; only allow a full reset when no entries exist,
    // otherwise a reconcile could silently wipe scheduled lessons. Fail closed if entries exist.
    const existing = await tx.timetablePeriod.findMany({ where: { schoolId: scope.schoolId, branchId, academicSessionId }, select: { id: true } });
    if (existing.length) {
      const entryCount = await tx.timetableEntry.count({ where: { periodId: { in: existing.map((e) => e.id) } } });
      if (entryCount > 0) throw new HttpError("CONFLICT", "Clear the scheduled lessons before changing the bell schedule");
      await tx.timetablePeriod.deleteMany({ where: { schoolId: scope.schoolId, branchId, academicSessionId } });
    }
    if (prepared.length) {
      await tx.timetablePeriod.createMany({
        data: prepared.map((p) => ({
          tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, academicSessionId,
          name: p.name, periodNumber: p.periodNumber, startMinutes: p.startMinutes, endMinutes: p.endMinutes,
          type: PTYPE_TO_DB[p.type] as never, order: p.order,
        })),
      });
    }
    await recordAudit(tx, scope, "TIMETABLE_PERIODS_UPDATED", "TimetablePeriod", `${branchId}:${academicSessionId}`, { count: prepared.length });
  });

  return listPeriods(scope);
}

/** Load a period validated to be in the caller's scope. */
export async function requirePeriodInScope(scope: OrgScope, periodId: string): Promise<{ id: string; type: string; branchId: string }> {
  const p = await prisma.timetablePeriod.findFirst({
    where: { id: periodId, schoolId: scope.schoolId, academicSessionId: requireSession(scope), ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select: { id: true, type: true, branchId: true },
  });
  if (!p) throw new HttpError("TIMETABLE_PERIOD_NOT_FOUND", "Timetable period not found");
  return p;
}
