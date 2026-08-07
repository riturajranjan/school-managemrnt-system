import type { Db } from "@/lib/data/store";
import { addMoney, sumMoney, zeroMoney } from "@/lib/finance/money";

export function maintenanceInsights(db: Db) {
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  const dueThisWeek = db.maintenanceRecords.filter((m) => (m.status === "scheduled" || m.status === "due-soon") && m.scheduledDate <= weekFromNow && m.scheduledDate >= today);
  const overdue = db.maintenanceRecords.filter((m) => m.status === "overdue");
  const vehiclesUnavailable = db.vehicles.filter((v) => v.status === "maintenance" || v.status === "breakdown");

  const completed = db.maintenanceRecords.filter((m) => m.status === "completed");
  const estimatedCost = sumMoney(
    db.maintenanceRecords.filter((m) => m.status !== "completed" && m.status !== "cancelled").map((m) => addMoney(m.cost, m.labourCost)),
    "INR",
  );
  const actualCost = completed.length > 0 ? sumMoney(completed.map((m) => addMoney(m.cost, m.labourCost)), "INR") : zeroMoney("INR");

  const breakdownCountByVehicle = new Map<string, number>();
  for (const record of db.maintenanceRecords.filter((m) => m.type === "breakdown-repair")) {
    breakdownCountByVehicle.set(record.vehicleId, (breakdownCountByVehicle.get(record.vehicleId) ?? 0) + 1);
  }
  const repeatBreakdownVehicles = Array.from(breakdownCountByVehicle.entries())
    .filter(([, count]) => count > 1)
    .map(([vehicleId, count]) => ({ vehicleId, count }));

  const upcomingInspections = db.maintenanceRecords.filter((m) => m.type === "inspection" && (m.status === "scheduled" || m.status === "due-soon")).sort((a, b) => (a.scheduledDate < b.scheduledDate ? -1 : 1));

  return { dueThisWeek, overdue, vehiclesUnavailable, estimatedCost, actualCost, repeatBreakdownVehicles, upcomingInspections };
}
