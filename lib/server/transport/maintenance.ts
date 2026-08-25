// Transport Maintenance — operational service records only, never a second
// procurement/accounting system. "Overdue" is derived at read time
// (scheduledDate < today, not completed/cancelled) — never a stored status.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { TransportMaintenanceInsightsDto, TransportMaintenanceRecordDto, TransportMaintenanceStatusDto, TransportMaintenanceTypeDto } from "@/lib/api/contracts";
import { resolveTransportBranch } from "./access";

const TYPE_TO_DB: Record<TransportMaintenanceTypeDto, string> = { "routine-service": "ROUTINE_SERVICE", repair: "REPAIR", inspection: "INSPECTION", tyre: "TYRE", battery: "BATTERY", other: "OTHER" };
const typeToUi = (t: string) => t.toLowerCase().replace(/_/g, "-") as TransportMaintenanceTypeDto;
const statusToUi = (s: string) => s.toLowerCase().replace(/_/g, "-") as TransportMaintenanceStatusDto;
const toNum = (d: Prisma.Decimal) => Number(d);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dateToUi = (d: Date) => d.toISOString().slice(0, 10);
const parseDate = (d: string) => new Date(`${d}T00:00:00.000Z`);
const todayUtc = () => new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);

const select = {
  id: true, vehicleId: true, type: true, status: true, scheduledDate: true, completedDate: true, vendor: true, odometerKm: true,
  partsCost: true, labourCost: true, notes: true, createdAt: true,
  vehicle: { select: { registrationNumber: true } },
} satisfies Prisma.TransportMaintenanceRecordSelect;
type Row = Prisma.TransportMaintenanceRecordGetPayload<{ select: typeof select }>;

function dto(r: Row): TransportMaintenanceRecordDto {
  const overdue = r.status !== "COMPLETED" && r.status !== "CANCELLED" && r.scheduledDate < todayUtc();
  const partsCost = toNum(r.partsCost), labourCost = toNum(r.labourCost);
  return {
    id: r.id, vehicleId: r.vehicleId, vehicleRegistration: r.vehicle.registrationNumber,
    type: typeToUi(r.type), status: statusToUi(r.status), scheduledDate: dateToUi(r.scheduledDate), completedDate: r.completedDate ? dateToUi(r.completedDate) : null,
    overdue, vendor: r.vendor, odometerKm: r.odometerKm, partsCost, labourCost, totalCost: partsCost + labourCost, notes: r.notes, createdAt: r.createdAt.toISOString(),
  };
}

export async function listMaintenanceRecords(scope: OrgScope, params: { vehicleId?: string; status?: string } = {}): Promise<TransportMaintenanceRecordDto[]> {
  const where: Prisma.TransportMaintenanceRecordWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.vehicleId) where.vehicleId = params.vehicleId;
  if (params.status) where.status = params.status.toUpperCase().replace(/-/g, "_") as never;
  const rows = await prisma.transportMaintenanceRecord.findMany({ where, orderBy: { scheduledDate: "desc" }, select });
  return rows.map(dto);
}

export async function getMaintenanceInsights(scope: OrgScope): Promise<TransportMaintenanceInsightsDto> {
  const branchFilter = scope.branchId ? { branchId: scope.branchId } : {};
  const today = todayUtc();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  const [scheduledOrInProgress, overdueCandidates, completedThisMonth] = await Promise.all([
    prisma.transportMaintenanceRecord.count({ where: { schoolId: scope.schoolId, ...branchFilter, status: { in: ["SCHEDULED", "IN_PROGRESS"] } } }),
    prisma.transportMaintenanceRecord.count({ where: { schoolId: scope.schoolId, ...branchFilter, status: { in: ["SCHEDULED", "IN_PROGRESS"] }, scheduledDate: { lt: today } } }),
    prisma.transportMaintenanceRecord.findMany({ where: { schoolId: scope.schoolId, ...branchFilter, status: "COMPLETED", completedDate: { gte: monthStart } }, select: { partsCost: true, labourCost: true } }),
  ]);

  const completedCostThisMonth = completedThisMonth.reduce((sum, r) => sum + toNum(r.partsCost) + toNum(r.labourCost), 0);
  return { scheduledOrInProgressCount: scheduledOrInProgress, overdueCount: overdueCandidates, completedThisMonthCount: completedThisMonth.length, completedCostThisMonth };
}

async function requireRecordInScope(scope: OrgScope, id: string): Promise<Row> {
  const row = await prisma.transportMaintenanceRecord.findFirst({ where: { id, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select });
  if (!row) throw new HttpError("NOT_FOUND", "Maintenance record not found");
  return row;
}

export const scheduleMaintenanceSchema = z.object({
  vehicleId: z.string().min(1),
  type: z.enum(["routine-service", "repair", "inspection", "tyre", "battery", "other"]),
  scheduledDate: dateStr,
  vendor: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function scheduleMaintenance(scope: OrgScope, raw: unknown): Promise<TransportMaintenanceRecordDto> {
  const input = parseInput(scheduleMaintenanceSchema, raw);
  const vehicle = await prisma.transportVehicle.findFirst({ where: { id: input.vehicleId, schoolId: scope.schoolId }, select: { id: true } });
  if (!vehicle) throw new HttpError("VALIDATION_ERROR", "Vehicle must be real and in this school");
  const branchId = await resolveTransportBranch(scope);
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.transportMaintenanceRecord.create({
      data: { tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, vehicleId: input.vehicleId, type: TYPE_TO_DB[input.type] as never, scheduledDate: parseDate(input.scheduledDate), vendor: input.vendor ?? null, notes: input.notes ?? null, createdByUserId: scope.actor.id },
      select: { id: true },
    });
    await recordAudit(tx, scope, "TRANSPORT_MAINTENANCE_SCHEDULED", "TransportMaintenanceRecord", row.id, { vehicleId: input.vehicleId, type: input.type });
    return row.id;
  });
  return dto(await requireRecordInScope(scope, created));
}

async function transitionStatus(scope: OrgScope, id: string, fromStatuses: string[], toStatus: string, auditAction: "TRANSPORT_MAINTENANCE_STARTED" | "TRANSPORT_MAINTENANCE_CANCELLED"): Promise<void> {
  const result = await prisma.transportMaintenanceRecord.updateMany({ where: { id, schoolId: scope.schoolId, status: { in: fromStatuses as never[] } }, data: { status: toStatus as never } });
  if (result.count === 0) {
    const current = await prisma.transportMaintenanceRecord.findUnique({ where: { id }, select: { status: true } });
    throw new HttpError("INVALID_STATUS_TRANSITION", `Record is ${current?.status.toLowerCase() ?? "unknown"} — cannot transition to ${toStatus.toLowerCase()}`);
  }
  await recordAudit(prisma, scope, auditAction, "TransportMaintenanceRecord", id);
}

export async function startMaintenance(scope: OrgScope, id: string): Promise<TransportMaintenanceRecordDto> {
  await requireRecordInScope(scope, id);
  await transitionStatus(scope, id, ["SCHEDULED"], "IN_PROGRESS", "TRANSPORT_MAINTENANCE_STARTED");
  return dto(await requireRecordInScope(scope, id));
}

export const completeMaintenanceSchema = z.object({ completedDate: dateStr.optional(), odometerKm: z.number().int().min(0).optional(), partsCost: z.number().min(0), labourCost: z.number().min(0) });

export async function completeMaintenance(scope: OrgScope, id: string, raw: unknown): Promise<TransportMaintenanceRecordDto> {
  const input = parseInput(completeMaintenanceSchema, raw);
  const existing = await requireRecordInScope(scope, id);
  if (existing.status === "COMPLETED" || existing.status === "CANCELLED") throw new HttpError("INVALID_STATUS_TRANSITION", `Record is ${existing.status.toLowerCase()} — cannot complete`);
  await prisma.$transaction(async (tx) => {
    await tx.transportMaintenanceRecord.update({
      where: { id },
      data: { status: "COMPLETED", completedDate: parseDate(input.completedDate ?? new Date().toISOString().slice(0, 10)), odometerKm: input.odometerKm ?? existing.odometerKm, partsCost: input.partsCost, labourCost: input.labourCost },
    });
    await recordAudit(tx, scope, "TRANSPORT_MAINTENANCE_COMPLETED", "TransportMaintenanceRecord", id, { partsCost: input.partsCost, labourCost: input.labourCost });
  });
  return dto(await requireRecordInScope(scope, id));
}

export async function cancelMaintenance(scope: OrgScope, id: string): Promise<TransportMaintenanceRecordDto> {
  await requireRecordInScope(scope, id);
  await transitionStatus(scope, id, ["SCHEDULED", "IN_PROGRESS"], "CANCELLED", "TRANSPORT_MAINTENANCE_CANCELLED");
  return dto(await requireRecordInScope(scope, id));
}
