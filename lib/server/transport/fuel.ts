// Transport Fuel — Decimal-safe fill-up log. No fabricated efficiency/
// anomaly scoring (km/L, "least efficient vehicle") — those need a real
// distance-per-fill formula this phase does not define; only real sums.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { TransportFuelInsightsDto, TransportFuelLogDto } from "@/lib/api/contracts";
import { resolveTransportBranch } from "./access";

const toNum = (d: Prisma.Decimal) => Number(d);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dateToUi = (d: Date) => d.toISOString().slice(0, 10);
const parseDate = (d: string) => new Date(`${d}T00:00:00.000Z`);

const select = {
  id: true, vehicleId: true, date: true, odometerKm: true, quantityLitres: true, ratePerLitre: true, totalCost: true,
  vendor: true, filledByName: true, fullTank: true, createdAt: true,
  vehicle: { select: { registrationNumber: true } },
} satisfies Prisma.TransportFuelLogSelect;
type Row = Prisma.TransportFuelLogGetPayload<{ select: typeof select }>;

function dto(r: Row): TransportFuelLogDto {
  return {
    id: r.id, vehicleId: r.vehicleId, vehicleRegistration: r.vehicle.registrationNumber, date: dateToUi(r.date), odometerKm: r.odometerKm,
    quantityLitres: toNum(r.quantityLitres), ratePerLitre: toNum(r.ratePerLitre), totalCost: toNum(r.totalCost),
    vendor: r.vendor, filledByName: r.filledByName, fullTank: r.fullTank, createdAt: r.createdAt.toISOString(),
  };
}

export async function listFuelLogs(scope: OrgScope, params: { vehicleId?: string } = {}): Promise<TransportFuelLogDto[]> {
  const where: Prisma.TransportFuelLogWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.vehicleId) where.vehicleId = params.vehicleId;
  const rows = await prisma.transportFuelLog.findMany({ where, orderBy: { date: "desc" }, select });
  return rows.map(dto);
}

export async function getFuelInsights(scope: OrgScope): Promise<TransportFuelInsightsDto> {
  const branchFilter = scope.branchId ? { branchId: scope.branchId } : {};
  const today = new Date();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const [thisMonth, fuelVehicleCount] = await Promise.all([
    prisma.transportFuelLog.findMany({ where: { schoolId: scope.schoolId, ...branchFilter, date: { gte: monthStart } }, select: { totalCost: true, quantityLitres: true } }),
    prisma.transportVehicle.count({ where: { schoolId: scope.schoolId, ...branchFilter, status: "ACTIVE", type: { not: "ELECTRIC_VEHICLE" } } }),
  ]);
  return {
    costThisMonth: thisMonth.reduce((sum, r) => sum + toNum(r.totalCost), 0),
    litresThisMonth: thisMonth.reduce((sum, r) => sum + toNum(r.quantityLitres), 0),
    fuelVehicleCount,
  };
}

export const logFuelEntrySchema = z.object({
  vehicleId: z.string().min(1),
  date: dateStr,
  odometerKm: z.number().int().min(0),
  quantityLitres: z.number().positive(),
  ratePerLitre: z.number().positive(),
  vendor: z.string().trim().max(200).optional(),
  filledByName: z.string().trim().max(200).optional(),
  fullTank: z.boolean().optional(),
});

export async function logFuelEntry(scope: OrgScope, raw: unknown): Promise<TransportFuelLogDto> {
  const input = parseInput(logFuelEntrySchema, raw);
  const vehicle = await prisma.transportVehicle.findFirst({ where: { id: input.vehicleId, schoolId: scope.schoolId }, select: { id: true, type: true } });
  if (!vehicle) throw new HttpError("VALIDATION_ERROR", "Vehicle must be real and in this school");
  if (vehicle.type === "ELECTRIC_VEHICLE") throw new HttpError("VALIDATION_ERROR", "Electric vehicles do not take fuel entries");

  const totalCost = Math.round(input.quantityLitres * input.ratePerLitre * 100) / 100;
  const branchId = await resolveTransportBranch(scope);
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.transportFuelLog.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, vehicleId: input.vehicleId, date: parseDate(input.date),
        odometerKm: input.odometerKm, quantityLitres: input.quantityLitres, ratePerLitre: input.ratePerLitre, totalCost,
        vendor: input.vendor ?? null, filledByName: input.filledByName ?? null, fullTank: input.fullTank ?? true, createdByUserId: scope.actor.id,
      },
      select: { id: true },
    });
    await recordAudit(tx, scope, "TRANSPORT_FUEL_LOGGED", "TransportFuelLog", row.id, { vehicleId: input.vehicleId, quantityLitres: input.quantityLitres });
    return row.id;
  });
  const row = await prisma.transportFuelLog.findUniqueOrThrow({ where: { id: created }, select });
  return dto(row);
}
