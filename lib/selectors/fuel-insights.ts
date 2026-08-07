import type { Db } from "@/lib/data/store";
import { sumMoney, zeroMoney } from "@/lib/finance/money";

export type FuelEfficiencyPoint = {
  recordId: string;
  date: string;
  kmSinceLast: number;
  litres: number;
  kmpl: number;
};

/** Efficiency is derived from consecutive odometer deltas between fill-ups —
 * FuelRecord never stores a kmpl field, since it would drift from the
 * underlying readings it's computed from. */
export function fuelEfficiencyByVehicle(db: Db, vehicleId: string): FuelEfficiencyPoint[] {
  const records = [...db.fuelRecords].filter((f) => f.vehicleId === vehicleId).sort((a, b) => a.odometerKm - b.odometerKm);
  const points: FuelEfficiencyPoint[] = [];
  for (let i = 1; i < records.length; i++) {
    const prev = records[i - 1];
    const curr = records[i];
    const kmSinceLast = curr.odometerKm - prev.odometerKm;
    if (kmSinceLast <= 0 || curr.quantityLitres <= 0) continue;
    points.push({ recordId: curr.id, date: curr.date, kmSinceLast, litres: curr.quantityLitres, kmpl: kmSinceLast / curr.quantityLitres });
  }
  return points;
}

export function fuelInsights(db: Db) {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const thisMonthRecords = db.fuelRecords.filter((f) => f.date >= monthStart);

  const totalCostThisMonth = thisMonthRecords.length > 0 ? sumMoney(thisMonthRecords.map((f) => f.totalCost), "INR") : zeroMoney("INR");
  const totalLitresThisMonth = thisMonthRecords.reduce((sum, f) => sum + f.quantityLitres, 0);

  const vehicleIds = Array.from(new Set(db.fuelRecords.map((f) => f.vehicleId)));
  const perVehicle = vehicleIds.map((vehicleId) => {
    const points = fuelEfficiencyByVehicle(db, vehicleId);
    const avgKmpl = points.length > 0 ? points.reduce((sum, p) => sum + p.kmpl, 0) / points.length : 0;
    return { vehicleId, points, avgKmpl };
  });

  // A fill-up performing well below a vehicle's own average is a signal
  // worth surfacing (possible pilferage or a leak), not a hard verdict.
  const anomalies = perVehicle.flatMap(({ vehicleId, points, avgKmpl }) =>
    points.filter((p) => avgKmpl > 0 && p.kmpl < avgKmpl * 0.7).map((p) => ({ vehicleId, ...p, expectedKmpl: avgKmpl })),
  );

  const leastEfficientVehicles = perVehicle
    .filter((v) => v.avgKmpl > 0)
    .sort((a, b) => a.avgKmpl - b.avgKmpl)
    .slice(0, 5);

  return { totalCostThisMonth, totalLitresThisMonth, perVehicle, anomalies, leastEfficientVehicles };
}
