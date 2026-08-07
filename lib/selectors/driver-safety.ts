import type { Db } from "@/lib/data/store";
import type { Driver } from "@/lib/types/transport";

export type DriverSafetyComponent = { key: string; label: string; value: number; weight: number };
export type DriverSafety = { score: number; components: DriverSafetyComponent[]; explanation: string[] };

/** A real, computed score (0-100) from this driver's own trip history — never
 * a punitive black-box number. `explanation` always lists exactly which
 * factors moved the score, so it stays auditable to the driver themself. */
export function computeDriverSafety(db: Db, driver: Driver): DriverSafety {
  const trips = db.transportTrips.filter((t) => t.driverId === driver.id && (t.status === "completed" || t.status === "delayed" || t.status === "in-progress"));
  const explanation: string[] = [];

  const delayedTrips = trips.filter((t) => t.status === "delayed").length;
  const onTimeHealth = trips.length > 0 ? 1 - delayedTrips / trips.length : 1;
  if (delayedTrips > 0) explanation.push(`${delayedTrips} delayed trip(s) out of ${trips.length}`);

  const tripIds = new Set(trips.map((t) => t.id));
  const deviations = db.routeDeviations.filter((d) => tripIds.has(d.tripId));
  const adherenceHealth = trips.length > 0 ? Math.max(0, 1 - deviations.length / trips.length) : 1;
  if (deviations.length > 0) explanation.push(`${deviations.length} route deviation(s) recorded`);

  const incidents = db.transportIncidents.filter((i) => i.tripId !== undefined && tripIds.has(i.tripId));
  const incidentHealth = Math.max(0, 1 - incidents.length * 0.2);
  if (incidents.length > 0) explanation.push(`${incidents.length} incident(s) linked to this driver's trips`);

  const training = db.driverTraining.filter((t) => t.driverId === driver.id);
  const hasCurrentTraining = training.some((t) => !t.expiresAt || t.expiresAt >= new Date().toISOString());
  const trainingHealth = training.length === 0 ? 0.5 : hasCurrentTraining ? 1 : 0.6;
  if (training.length === 0) explanation.push("No training records on file");
  else if (!hasCurrentTraining) explanation.push("Training certification has expired");

  const components: DriverSafetyComponent[] = [
    { key: "on-time", label: "On-time performance", value: Math.round(onTimeHealth * 100), weight: 0.3 },
    { key: "adherence", label: "Route adherence", value: Math.round(adherenceHealth * 100), weight: 0.25 },
    { key: "incidents", label: "Incident-free record", value: Math.round(incidentHealth * 100), weight: 0.25 },
    { key: "training", label: "Training completion", value: Math.round(trainingHealth * 100), weight: 0.2 },
  ];
  const score = Math.max(0, Math.min(100, Math.round(components.reduce((sum, c) => sum + c.value * c.weight, 0))));

  if (explanation.length === 0) explanation.push("No delays, deviations or incidents recorded — clean trip history.");

  return { score, components, explanation };
}
