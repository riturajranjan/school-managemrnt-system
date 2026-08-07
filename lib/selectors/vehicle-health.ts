import type { Db } from "@/lib/data/store";
import type { Vehicle } from "@/lib/types/transport";

export type VehicleHealthComponent = { key: string; label: string; value: number; weight: number };
export type VehicleHealth = {
  score: number;
  components: VehicleHealthComponent[];
  mainRisk?: string;
  upcomingService?: string;
  expiringDocument?: string;
};

/** A real, computed score (0-100) from maintenance status, document
 * validity, incident history and breakdown history — never a placeholder. */
export function computeVehicleHealth(db: Db, vehicle: Vehicle): VehicleHealth {
  const documents = db.vehicleDocuments.filter((d) => d.vehicleId === vehicle.id);
  const validDocs = documents.filter((d) => d.status === "valid").length;
  const documentHealth = documents.length > 0 ? validDocs / documents.length : 1;

  const maintenance = db.maintenanceRecords.filter((m) => m.vehicleId === vehicle.id);
  const overdueOrDueSoon = maintenance.filter((m) => m.status === "overdue" || m.status === "due-soon").length;
  const maintenanceHealth = maintenance.length > 0 ? 1 - overdueOrDueSoon / maintenance.length : 1;

  const incidents = db.transportIncidents.filter((i) => i.vehicleId === vehicle.id);
  const breakdownIncidents = incidents.filter((i) => i.type === "breakdown" || i.type === "accident").length;
  const incidentHealth = Math.max(0, 1 - breakdownIncidents * 0.25);

  const odometerHealth = vehicle.odometerKm > 150000 ? 0.6 : vehicle.odometerKm > 90000 ? 0.8 : 1;

  const components: VehicleHealthComponent[] = [
    { key: "documents", label: "Document validity", value: Math.round(documentHealth * 100), weight: 0.3 },
    { key: "maintenance", label: "Maintenance status", value: Math.round(maintenanceHealth * 100), weight: 0.3 },
    { key: "incidents", label: "Incident history", value: Math.round(incidentHealth * 100), weight: 0.25 },
    { key: "odometer", label: "Odometer / age", value: Math.round(odometerHealth * 100), weight: 0.15 },
  ];
  const score = Math.max(0, Math.min(100, Math.round(components.reduce((sum, c) => sum + c.value * c.weight, 0))));

  const expiringDoc = documents
    .filter((d) => d.status === "expiring-soon" || d.status === "expired")
    .sort((a, b) => (a.expiryDate ?? "") < (b.expiryDate ?? "") ? -1 : 1)[0];
  const upcomingMaintenance = maintenance
    .filter((m) => m.status === "scheduled" || m.status === "due-soon" || m.status === "overdue")
    .sort((a, b) => (a.scheduledDate < b.scheduledDate ? -1 : 1))[0];

  const risks: string[] = [];
  if (overdueOrDueSoon > 0) risks.push("maintenance due");
  if (documents.some((d) => d.status === "expired")) risks.push("expired document");
  if (breakdownIncidents > 0) risks.push("recent breakdown history");

  return {
    score,
    components,
    mainRisk: risks[0],
    upcomingService: upcomingMaintenance ? `${upcomingMaintenance.type.replace(/-/g, " ")} on ${upcomingMaintenance.scheduledDate}` : undefined,
    expiringDocument: expiringDoc ? `${expiringDoc.type.replace(/-/g, " ")} — ${expiringDoc.status === "expired" ? "expired" : "expiring"} ${expiringDoc.expiryDate ?? ""}` : undefined,
  };
}
